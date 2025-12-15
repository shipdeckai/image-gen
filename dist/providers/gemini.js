import { request } from 'undici';
import { ImageProvider } from './base.js';
import { ProviderError } from '../types.js';
import { logger } from '../util/logger.js';
/**
 * Google Gemini provider using Gemini 2.5 Flash Image for generation and editing
 * Documentation: https://ai.google.dev/gemini-api/docs/image-generation
 */
export class GeminiProvider extends ImageProvider {
    name = 'GEMINI';
    constructor() {
        super();
    }
    getApiKey() {
        return process.env.GEMINI_API_KEY;
    }
    isConfigured() {
        return !!this.getApiKey();
    }
    getRequiredEnvVars() {
        return ['GEMINI_API_KEY'];
    }
    getCapabilities() {
        return {
            supportsGenerate: true,
            supportsEdit: true, // Gemini and Imagen support editing
            maxWidth: 2048, // Imagen 4 supports up to 2K
            maxHeight: 2048,
            defaultModel: 'imagen-4.0-generate-001',
            supportedModels: [
                // Imagen 4 models (Latest - December 2025)
                'imagen-4.0-generate-001', // Standard - best balance of quality/speed
                'imagen-4.0-ultra-generate-001', // Ultra quality - highest fidelity
                'imagen-4.0-fast-generate-001', // Fast - optimized for speed
                // Imagen 3 (Legacy)
                'imagen-3.0-generate-002', // Previous generation
                // Gemini multimodal (for editing)
                'gemini-2.5-flash-image-preview' // Multimodal editing
            ],
            supportedAspectRatios: ['1:1', '3:4', '4:3', '9:16', '16:9'],
            supportedSizes: ['1K', '2K'], // For Ultra/Standard models
            specialFeatures: [
                'text_rendering', // Good text generation
                'synthid_watermark', // All images watermarked
                'person_generation', // Configurable person generation
                'multiple_images' // Generate 1-4 images per request
            ]
        };
    }
    async generate(input) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ProviderError('Gemini API key not configured', this.name);
        }
        // Default to Imagen 4 for generation (December 2025)
        const model = input.model || 'imagen-4.0-generate-001';
        const isImagen = model.startsWith('imagen-');
        logger.info(`Gemini generating image`, { model, isImagen, prompt: input.prompt.slice(0, 50) });
        try {
            const controller = this.createTimeout(60000);
            if (isImagen) {
                // Use Imagen API (predict endpoint)
                return await this.generateWithImagen(input, model, apiKey, controller);
            }
            else {
                // Use Gemini multimodal API (generateContent endpoint)
                return await this.generateWithGemini(input, model, apiKey, controller);
            }
        }
        catch (error) {
            if (error instanceof ProviderError)
                throw error;
            const message = error instanceof Error ? error.message : 'Unknown error';
            const isRetryable = message.includes('timeout') || message.includes('ECONNREFUSED');
            throw new ProviderError(`Gemini request failed: ${message}`, this.name, isRetryable, error);
        }
    }
    /**
     * Generate with Imagen 4 API
     */
    async generateWithImagen(input, model, apiKey, controller) {
        // Calculate aspect ratio from dimensions
        const aspectRatio = this.calculateAspectRatio(input.width || 1024, input.height || 1024);
        const requestBody = {
            instances: [{
                    prompt: input.prompt
                }],
            parameters: {
                sampleCount: 1,
                aspectRatio,
                // personGeneration: 'allow_adult' // Default
            }
        };
        const { statusCode, body } = await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        const response = await body.json();
        if (statusCode !== 200) {
            const message = response.error?.message || `Imagen API error: ${statusCode}`;
            const isRetryable = statusCode >= 500 || statusCode === 429;
            throw new ProviderError(message, this.name, isRetryable, response);
        }
        // Extract images from Imagen response
        const predictions = response.predictions || [];
        const images = [];
        for (const prediction of predictions) {
            if (prediction.bytesBase64Encoded) {
                const mimeType = prediction.mimeType || 'image/png';
                const format = this.extractFormat(mimeType);
                const dataUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
                images.push({ dataUrl, format });
            }
        }
        if (images.length === 0) {
            throw new ProviderError('No image generated by Imagen', this.name, false);
        }
        return {
            images,
            provider: this.name,
            model,
            warnings: ['All Imagen images include a SynthID watermark']
        };
    }
    /**
     * Generate with Gemini multimodal API (legacy)
     */
    async generateWithGemini(input, model, apiKey, controller) {
        const requestBody = {
            contents: [{
                    parts: [{
                            text: input.prompt
                        }]
                }],
            generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192
            }
        };
        logger.info(`Requesting Gemini image (1:1 output)`);
        const { statusCode, body } = await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        const response = await body.json();
        if (statusCode !== 200) {
            const message = response.error?.message || `Gemini API error: ${statusCode}`;
            const isRetryable = statusCode >= 500 || statusCode === 429;
            throw new ProviderError(message, this.name, isRetryable, response);
        }
        // Extract image from response
        const candidates = response.candidates?.[0];
        const content = candidates?.content;
        const parts = content?.parts;
        if (!parts || parts.length === 0) {
            throw new ProviderError('No image generated in response', this.name, false);
        }
        const images = [];
        for (const part of parts) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                const format = this.extractFormat(mimeType);
                const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                images.push({ dataUrl, format });
            }
        }
        if (images.length === 0) {
            const textResponse = parts.find((p) => p.text)?.text;
            throw new ProviderError(textResponse || 'Gemini did not return an image', this.name, false);
        }
        return {
            images,
            provider: this.name,
            model,
            warnings: [
                'All Gemini images include a SynthID watermark',
                'Gemini multimodal currently only supports 1:1 aspect ratio'
            ]
        };
    }
    /**
     * Calculate aspect ratio string from dimensions
     */
    calculateAspectRatio(width, height) {
        const ratio = width / height;
        if (Math.abs(ratio - 1) < 0.1)
            return '1:1';
        if (Math.abs(ratio - 4 / 3) < 0.1)
            return '4:3';
        if (Math.abs(ratio - 3 / 4) < 0.1)
            return '3:4';
        if (Math.abs(ratio - 16 / 9) < 0.1)
            return '16:9';
        if (Math.abs(ratio - 9 / 16) < 0.1)
            return '9:16';
        // Default to closest standard
        if (ratio > 1.5)
            return '16:9';
        if (ratio < 0.7)
            return '9:16';
        if (ratio > 1)
            return '4:3';
        if (ratio < 1)
            return '3:4';
        return '1:1';
    }
    async edit(input) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ProviderError('Gemini API key not configured', this.name);
        }
        const model = input.model || 'gemini-2.5-flash-image-preview';
        logger.info(`Gemini editing image`, { model, prompt: input.prompt.slice(0, 50) });
        try {
            const controller = this.createTimeout(60000);
            // Extract base image data (supports both data URLs and file paths)
            const baseImageData = await this.getImageBuffer(input.baseImage);
            // Build multi-modal request for image editing
            // Gemini 2.5 Flash Image can handle up to 3 images for composition/editing
            const parts = [
                {
                    inlineData: {
                        mimeType: baseImageData.mimeType,
                        data: baseImageData.buffer.toString('base64')
                    }
                }
            ];
            // Add mask if provided (Gemini treats this as a second image for guidance)
            if (input.maskImage) {
                const maskData = await this.getImageBuffer(input.maskImage);
                parts.push({
                    inlineData: {
                        mimeType: maskData.mimeType,
                        data: maskData.buffer.toString('base64')
                    }
                });
                // Add specific instructions for mask-based editing
                parts.push({
                    text: `Using the second image as a mask/guide, ${input.prompt}`
                });
            }
            else {
                // Without mask, provide direct editing instructions
                parts.push({
                    text: input.prompt
                });
            }
            const requestBody = {
                contents: [{
                        parts
                    }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192
                }
            };
            const { statusCode, body } = await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            const response = await body.json();
            if (statusCode !== 200) {
                const message = response.error?.message || `Gemini API error: ${statusCode}`;
                const isRetryable = statusCode >= 500 || statusCode === 429;
                throw new ProviderError(message, this.name, isRetryable, response);
            }
            // Extract edited image from response
            const candidates = response.candidates?.[0];
            const content = candidates?.content;
            const responseParts = content?.parts;
            if (!responseParts || responseParts.length === 0) {
                throw new ProviderError('No edited image in response', this.name, false);
            }
            const images = [];
            for (const part of responseParts) {
                if (part.inlineData) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const format = this.extractFormat(mimeType);
                    const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                    images.push({ dataUrl, format });
                }
            }
            if (images.length === 0) {
                const textResponse = responseParts.find((p) => p.text)?.text;
                throw new ProviderError(textResponse || 'Gemini did not return an edited image', this.name, false);
            }
            return {
                images,
                provider: this.name,
                model,
                warnings: [
                    'All Gemini images include a SynthID watermark',
                    ...(input.maskImage ? [] : ['Editing without mask - Gemini will intelligently detect areas to modify'])
                ]
            };
        }
        catch (error) {
            if (error instanceof ProviderError)
                throw error;
            const message = error instanceof Error ? error.message : 'Unknown error';
            const isRetryable = message.includes('timeout') || message.includes('ECONNREFUSED');
            throw new ProviderError(`Gemini edit request failed: ${message}`, this.name, isRetryable, error);
        }
    }
    // Note: calculateAspectRatio method removed as aspectRatio parameter is not supported in current Gemini API
    // The API currently only supports 1:1 (square) output regardless of requested dimensions
    /**
     * Extract format from MIME type
     */
    extractFormat(mimeType) {
        const format = mimeType.split('/')[1]?.toLowerCase();
        switch (format) {
            case 'png':
                return 'png';
            case 'jpeg':
            case 'jpg':
                return 'jpeg';
            case 'webp':
                return 'webp';
            default:
                return 'png'; // Default fallback
        }
    }
}
//# sourceMappingURL=gemini.js.map
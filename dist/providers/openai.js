import { request } from 'undici';
import { ImageProvider } from './base.js';
import { ProviderError } from '../types.js';
import { logger } from '../util/logger.js';
/**
 * OpenAI DALL-E provider for image generation
 */
export class OpenAIProvider extends ImageProvider {
    name = 'OPENAI';
    constructor() {
        super();
    }
    getApiKey() {
        return process.env.OPENAI_API_KEY;
    }
    isConfigured() {
        return !!this.getApiKey();
    }
    getRequiredEnvVars() {
        return ['OPENAI_API_KEY'];
    }
    getCapabilities() {
        return {
            supportsGenerate: true,
            supportsEdit: true,
            maxWidth: 1536, // gpt-image-1.5/1: 1536x1024, DALL-E 3: 1792x1024
            maxHeight: 1536, // gpt-image-1.5/1: 1024x1536, DALL-E 3: 1024x1792
            supportedModels: ['gpt-image-1.5', 'gpt-image-1', 'dall-e-3', 'dall-e-2']
        };
    }
    async generate(input) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ProviderError('OpenAI API key not configured', this.name);
        }
        const model = input.model || 'gpt-image-1.5'; // gpt-image-1.5 is OpenAI's latest (Dec 2025) - 4x faster, better text
        const size = this.mapSize(input.width, input.height, model);
        logger.info(`OpenAI generating image`, { model, size, prompt: input.prompt.slice(0, 50) });
        try {
            const controller = this.createTimeout();
            // Build request body based on model
            const requestBody = {
                model,
                prompt: input.prompt,
                size,
                n: 1
            };
            // gpt-image-1 and gpt-image-1.5 don't support response_format parameter
            // Only dall-e-3 and dall-e-2 support it
            if (model === 'dall-e-3' || model === 'dall-e-2') {
                requestBody.response_format = 'b64_json';
            }
            const { statusCode, body } = await request('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            const response = await body.json();
            if (statusCode !== 200) {
                const message = response.error?.message || `OpenAI API error: ${statusCode}`;
                const isRetryable = statusCode >= 500 || statusCode === 429;
                throw new ProviderError(message, this.name, isRetryable, response);
            }
            // Handle response based on model
            const images = await Promise.all(response.data.map(async (img) => {
                if (img.b64_json) {
                    // dall-e models return base64
                    return {
                        dataUrl: `data:image/png;base64,${img.b64_json}`,
                        format: 'png'
                    };
                }
                else if (img.url) {
                    // gpt-image-1 and gpt-image-1.5 return URL - download and convert to data URL
                    const imageResponse = await fetch(img.url);
                    const arrayBuffer = await imageResponse.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    return {
                        dataUrl: this.bufferToDataUrl(buffer, 'image/png'),
                        format: 'png'
                    };
                }
                throw new ProviderError('No image data in OpenAI response', this.name, false);
            }));
            return {
                images,
                provider: this.name,
                model
            };
        }
        catch (error) {
            if (error instanceof ProviderError)
                throw error;
            const message = error instanceof Error ? error.message : 'Unknown error';
            const isRetryable = message.includes('timeout') || message.includes('ECONNREFUSED');
            throw new ProviderError(`OpenAI request failed: ${message}`, this.name, isRetryable, error);
        }
    }
    async edit(input) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new ProviderError('OpenAI API key not configured', this.name);
        }
        logger.info(`OpenAI editing image`, { prompt: input.prompt.slice(0, 50) });
        try {
            // gpt-image-1 edit can take up to 180 seconds according to community reports
            const controller = this.createTimeout(180000); // 3 minutes
            // Convert base64 to blob for form data (supports both data URLs and file paths)
            let baseImageBuffer = (await this.getImageBuffer(input.baseImage)).buffer;
            // OpenAI requires RGBA format - convert if needed
            try {
                const sharp = (await import('sharp')).default;
                const metadata = await sharp(baseImageBuffer).metadata();
                if (metadata.channels === 3) {
                    // RGB image - add alpha channel
                    baseImageBuffer = await sharp(baseImageBuffer)
                        .ensureAlpha()
                        .png()
                        .toBuffer();
                }
            }
            catch (err) {
                logger.warn('Failed to convert image to RGBA, proceeding with original', { error: err });
            }
            const maskBuffer = input.maskImage ? (await this.getImageBuffer(input.maskImage)).buffer : undefined;
            // Select model - gpt-image-1.5 is newest (Dec 2025), better editing consistency
            const model = input.model || 'gpt-image-1.5';
            // Create multipart form data manually
            const boundary = `----FormBoundary${Date.now()}`;
            const parts = [];
            // Add image part
            parts.push(Buffer.from(`--${boundary}\r\n` +
                `Content-Disposition: form-data; name="image"; filename="image.png"\r\n` +
                `Content-Type: image/png\r\n\r\n`));
            parts.push(baseImageBuffer);
            parts.push(Buffer.from('\r\n'));
            // Add mask if provided
            if (maskBuffer) {
                parts.push(Buffer.from(`--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="mask"; filename="mask.png"\r\n` +
                    `Content-Type: image/png\r\n\r\n`));
                parts.push(maskBuffer);
                parts.push(Buffer.from('\r\n'));
            }
            // Add other fields
            parts.push(Buffer.from(`--${boundary}\r\n` +
                `Content-Disposition: form-data; name="model"\r\n\r\n` +
                `${model}\r\n`));
            parts.push(Buffer.from(`--${boundary}\r\n` +
                `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
                `${input.prompt}\r\n`));
            // response_format only supported for dall-e-2, gpt-image-1 and gpt-image-1.5 use output_format
            if (model === 'dall-e-2') {
                parts.push(Buffer.from(`--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
                    `b64_json\r\n`));
            }
            else {
                // gpt-image-1/1.5 use output_format and return URL by default
                parts.push(Buffer.from(`--${boundary}\r\n` +
                    `Content-Disposition: form-data; name="output_format"\r\n\r\n` +
                    `png\r\n`));
            }
            parts.push(Buffer.from(`--${boundary}\r\n` +
                `Content-Disposition: form-data; name="n"\r\n\r\n` +
                `1\r\n`));
            parts.push(Buffer.from(`--${boundary}--\r\n`));
            const formData = Buffer.concat(parts);
            const { statusCode, body } = await request('https://api.openai.com/v1/images/edits', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`
                },
                body: formData,
                signal: controller.signal
            });
            const response = await body.json();
            if (statusCode !== 200) {
                const message = response.error?.message || `OpenAI API error: ${statusCode}`;
                const isRetryable = statusCode >= 500 || statusCode === 429;
                throw new ProviderError(message, this.name, isRetryable, response);
            }
            // Handle response based on model
            const images = await Promise.all(response.data.map(async (img) => {
                if (img.b64_json) {
                    // dall-e-2 returns base64
                    return {
                        dataUrl: `data:image/png;base64,${img.b64_json}`,
                        format: 'png'
                    };
                }
                else if (img.url) {
                    // gpt-image-1/1.5 return URL - download and convert to data URL
                    const imageResponse = await fetch(img.url);
                    const arrayBuffer = await imageResponse.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    return {
                        dataUrl: this.bufferToDataUrl(buffer, 'image/png'),
                        format: 'png'
                    };
                }
                throw new ProviderError('No image data in OpenAI response', this.name, false);
            }));
            return {
                images,
                provider: this.name,
                model
            };
        }
        catch (error) {
            if (error instanceof ProviderError)
                throw error;
            const message = error instanceof Error ? error.message : 'Unknown error';
            const isRetryable = message.includes('timeout') || message.includes('ECONNREFUSED');
            throw new ProviderError(`OpenAI request failed: ${message}`, this.name, isRetryable, error);
        }
    }
    /**
     * Map width/height to OpenAI size strings
     * gpt-image-1.5/1 supports: 1024x1024, 1536x1024, 1024x1536
     * DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
     */
    mapSize(width, height, model) {
        const isLegacyDalle = model === 'dall-e-3' || model === 'dall-e-2';
        // Exact size matches
        if (width && height) {
            if (width === 1024 && height === 1024)
                return '1024x1024';
            if (isLegacyDalle) {
                // DALL-E 3 sizes
                if (width === 1792 && height === 1024)
                    return '1792x1024';
                if (width === 1024 && height === 1792)
                    return '1024x1792';
            }
            else {
                // gpt-image-1.5/1 sizes
                if (width === 1536 && height === 1024)
                    return '1536x1024';
                if (width === 1024 && height === 1536)
                    return '1024x1536';
            }
        }
        // Default based on aspect ratio
        if (width && height) {
            const ratio = width / height;
            if (isLegacyDalle) {
                if (ratio > 1.5)
                    return '1792x1024'; // Landscape
                if (ratio < 0.7)
                    return '1024x1792'; // Portrait
            }
            else {
                if (ratio > 1.2)
                    return '1536x1024'; // Landscape
                if (ratio < 0.8)
                    return '1024x1536'; // Portrait
            }
        }
        return '1024x1024'; // Square default
    }
}
//# sourceMappingURL=openai.js.map
import { request } from 'undici';
import { ImageProvider } from './base.js';
import { ProviderError } from '../types.js';
import { logger } from '../util/logger.js';
/**
 * Black Forest Labs (Flux) provider for high-quality image generation
 * Documentation: https://docs.bfl.ai/
 */
export class BFLProvider extends ImageProvider {
    name = 'BFL';
    constructor() {
        super();
    }
    getApiKey() {
        return process.env.BFL_API_KEY;
    }
    isConfigured() {
        return !!this.getApiKey();
    }
    getRequiredEnvVars() {
        return ['BFL_API_KEY'];
    }
    getCapabilities() {
        return {
            supportsGenerate: true,
            supportsEdit: true, // Via Flux Kontext and Flux Fill
            maxWidth: 2048,
            maxHeight: 2048,
            defaultModel: 'flux-2-pro',
            supportedModels: [
                // FLUX.2 models (Latest - November 2025)
                'flux-2-pro', // State-of-the-art quality, 8 reference images - fastest
                'flux-2-flex', // Configurable steps/guidance, 10 reference images, best text
                // FLUX 1.x models (Legacy but still supported)
                'flux1.1-pro', // Standard pro model - $0.04
                'flux1.1-pro-ultra', // Ultra high-res (4MP) - $0.06
                'flux-kontext-pro', // Create and edit with text+images - $0.04
                'flux-kontext-max', // Premium editing with typography - $0.08
                'flux-fill-pro' // Inpainting model - $0.05
            ],
            specialFeatures: [
                'multi_reference_images', // Up to 10 reference images (FLUX.2)
                'character_consistency', // Style/character preservation
                'text_rendering', // Enhanced typography (FLUX.2 flex)
                'photorealistic', // Ultra-high quality
                'ultra_high_resolution', // Up to 4MP
                'raw_photography', // Natural photo style
                'inpainting', // Mask-based editing
                'aspect_ratio_control' // Flexible aspect ratios
            ]
        };
    }
    async generate(input) {
        // Validate API key
        const apiKey = this.getApiKey();
        if (!this.validateApiKey(apiKey)) {
            throw new ProviderError('BFL API key not configured or invalid', this.name, false);
        }
        // Validate prompt
        this.validatePrompt(input.prompt);
        // Check rate limit
        await this.checkRateLimit();
        // Check cache
        const cacheKey = this.generateCacheKey(input);
        const cached = this.getCachedResult(cacheKey);
        if (cached)
            return cached;
        // Select appropriate model based on request (default to FLUX.2 Pro - December 2025)
        const model = input.model || 'flux-2-pro';
        logger.info(`BFL generating image`, { model, prompt: input.prompt.slice(0, 50) });
        // Execute with retry logic
        return this.executeWithRetry(async () => {
            const controller = this.createTimeout(90000); // BFL can take longer for ultra models
            try {
                // Build request body
                const requestBody = {
                    prompt: input.prompt,
                    width: input.width || 1024,
                    height: input.height || 1024,
                    // BFL uses steps for quality control
                    steps: model.includes('ultra') ? 50 : 28,
                    // Guidance scale for prompt adherence
                    guidance: 3.5,
                    // Safety tolerance
                    safety_tolerance: 2,
                    // Output format
                    output_format: 'png'
                };
                // Add seed if specified
                if (input.seed) {
                    requestBody.seed = input.seed;
                }
                // Determine endpoint based on model
                const endpoint = this.getEndpointForModel(model);
                const { statusCode, body } = await request(`https://api.bfl.ml/${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'X-Key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                const response = await body.json();
                if (statusCode !== 200) {
                    const message = response.error?.message || `BFL API error: ${statusCode}`;
                    const isRetryable = statusCode >= 500 || statusCode === 429;
                    throw new ProviderError(message, this.name, isRetryable, response);
                }
                // Handle async generation (BFL returns a task ID for polling)
                if (response.id && !response.sample) {
                    // Poll for result
                    const polledResponse = await this.pollForResult(response.id, controller, apiKey);
                    const result = await this.processResult(polledResponse, model);
                    this.cacheResult(cacheKey, result);
                    return result;
                }
                // Direct result
                const result = await this.processResult(response, model);
                // Cache successful result
                this.cacheResult(cacheKey, result);
                return result;
            }
            catch (error) {
                if (error instanceof ProviderError)
                    throw error;
                const message = error instanceof Error ? error.message : 'Unknown error';
                const isRetryable = message.includes('timeout') || message.includes('ECONNREFUSED');
                throw new ProviderError(`BFL request failed: ${message}`, this.name, isRetryable, error);
            }
            finally {
                // Cleanup controller
                this.cleanupController(controller);
            }
        });
    }
    async edit(input) {
        // Validate API key
        const apiKey = this.getApiKey();
        if (!this.validateApiKey(apiKey)) {
            throw new ProviderError('BFL API key not configured or invalid', this.name, false);
        }
        // Validate prompt
        this.validatePrompt(input.prompt);
        // Check rate limit
        await this.checkRateLimit();
        // Choose model based on whether we have a mask
        // Flux Kontext: General editing without mask
        // Flux Fill: Inpainting with mask
        const model = input.maskImage ? 'flux-fill-pro' : 'flux-kontext-pro';
        const isKontext = !input.maskImage;
        logger.info(`BFL editing image with ${isKontext ? 'Flux Kontext' : 'Flux Fill'}`, { prompt: input.prompt.slice(0, 50) });
        // Execute with retry logic
        return this.executeWithRetry(async () => {
            const controller = this.createTimeout(60000);
            try {
                // Extract base image data with size validation (supports both data URLs and file paths)
                const baseImageData = await this.getImageBuffer(input.baseImage);
                // Detect dimensions if not provided (needed for aspect ratio calculation)
                let width = input.width;
                let height = input.height;
                if (!width || !height) {
                    const dimensions = await this.detectImageDimensions(input.baseImage);
                    width = width || dimensions.width;
                    height = height || dimensions.height;
                }
                let endpoint;
                let requestBody;
                if (isKontext) {
                    // Flux Kontext: Uses aspect_ratio instead of width/height
                    // All outputs are ~1MP total (e.g., 1024x1024, 1365x768 for 16:9, etc.)
                    endpoint = 'https://api.bfl.ml/v1/flux-kontext-pro';
                    // Calculate aspect ratio from dimensions
                    const aspectRatio = this.calculateAspectRatio(width, height);
                    requestBody = {
                        prompt: input.prompt,
                        input_image: baseImageData.buffer.toString('base64'),
                        aspect_ratio: aspectRatio,
                        steps: 28,
                        guidance: 3.5,
                        safety_tolerance: 2,
                        output_format: 'png'
                    };
                }
                else {
                    // Flux Fill: Inpainting with mask - uses width/height
                    endpoint = 'https://api.bfl.ml/v1/flux-pro-1.0-fill';
                    requestBody = {
                        prompt: input.prompt,
                        image: baseImageData.buffer.toString('base64'),
                        width,
                        height,
                        steps: 28,
                        guidance: 30, // Higher guidance for inpainting
                        output_format: 'png'
                    };
                    // Add mask for Fill
                    const maskData = await this.getImageBuffer(input.maskImage);
                    requestBody.mask = maskData.buffer.toString('base64');
                }
                const { statusCode, body } = await request(endpoint, {
                    method: 'POST',
                    headers: {
                        'X-Key': apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                const response = await body.json();
                if (statusCode !== 200) {
                    const message = response.error?.message || `BFL API error: ${statusCode}`;
                    const isRetryable = statusCode >= 500 || statusCode === 429;
                    throw new ProviderError(message, this.name, isRetryable, response);
                }
                // Handle async result
                if (response.id && !response.sample) {
                    const polledResponse = await this.pollForResult(response.id, controller, apiKey);
                    return await this.processResult(polledResponse, model);
                }
                return await this.processResult(response, model);
            }
            catch (error) {
                if (error instanceof ProviderError)
                    throw error;
                const message = error instanceof Error ? error.message : 'Unknown error';
                const isRetryable = message.includes('timeout') || message.includes('ECONNREFUSED');
                throw new ProviderError(`BFL edit request failed: ${message}`, this.name, isRetryable, error);
            }
            finally {
                // Cleanup controller
                this.cleanupController(controller);
            }
        });
    }
    /**
     * Get API endpoint for model
     */
    getEndpointForModel(model) {
        const endpoints = {
            // FLUX.2 models
            'flux-2-pro': 'v1/flux-2-pro',
            'flux-2-flex': 'v1/flux-2-flex',
            // FLUX 1.x models
            'flux1.1-pro': 'v1/flux-pro-1.1',
            'flux1.1-pro-ultra': 'v1/flux-pro-1.1-ultra',
            'flux-kontext-pro': 'v1/flux-kontext-pro',
            'flux-kontext-max': 'v1/flux-kontext-max',
            'flux-fill-pro': 'v1/flux-fill'
        };
        return endpoints[model] || 'v1/flux-2-pro';
    }
    /**
     * Calculate aspect ratio string from width and height
     * Kontext supports ratios from 3:7 to 7:3
     */
    calculateAspectRatio(width, height) {
        const ratio = width / height;
        // Common aspect ratios - return standard ones where close
        if (Math.abs(ratio - 1) < 0.05)
            return '1:1';
        if (Math.abs(ratio - 16 / 9) < 0.05)
            return '16:9';
        if (Math.abs(ratio - 9 / 16) < 0.05)
            return '9:16';
        if (Math.abs(ratio - 4 / 3) < 0.05)
            return '4:3';
        if (Math.abs(ratio - 3 / 4) < 0.05)
            return '3:4';
        if (Math.abs(ratio - 21 / 9) < 0.05)
            return '21:9';
        if (Math.abs(ratio - 9 / 21) < 0.05)
            return '9:21';
        if (Math.abs(ratio - 3 / 2) < 0.05)
            return '3:2';
        if (Math.abs(ratio - 2 / 3) < 0.05)
            return '2:3';
        // For custom ratios, calculate GCD and simplify
        const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        const simplifiedW = Math.round(width / divisor);
        const simplifiedH = Math.round(height / divisor);
        // Clamp to Kontext's supported range (3:7 to 7:3)
        const minRatio = 3 / 7; // ~0.43
        const maxRatio = 7 / 3; // ~2.33
        if (ratio < minRatio) {
            return '3:7'; // Most portrait
        }
        else if (ratio > maxRatio) {
            return '7:3'; // Most landscape
        }
        return `${simplifiedW}:${simplifiedH}`;
    }
    /**
     * Poll for async result with exponential backoff
     */
    async pollForResult(taskId, controller, apiKey) {
        const maxAttempts = 30;
        const initialDelay = 1000; // 1 second
        const maxDelay = 10000; // 10 seconds
        for (let i = 0; i < maxAttempts; i++) {
            // Exponential backoff with jitter
            const delay = Math.min(initialDelay * Math.pow(1.5, i), maxDelay) + Math.random() * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
            // Use the correct API domain (.ml not .ai)
            const { statusCode, body } = await request(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
                method: 'GET',
                headers: {
                    'X-Key': apiKey
                },
                signal: controller.signal
            });
            const result = await body.json();
            if (statusCode === 200 && result.status === 'Ready') {
                return result;
            }
            if (result.status === 'Failed') {
                throw new ProviderError('BFL generation failed', this.name, false, result);
            }
            logger.debug(`BFL polling attempt ${i + 1}/${maxAttempts}, status: ${result.status}`);
        }
        throw new ProviderError('BFL generation timeout - exceeded max polling attempts', this.name, true);
    }
    /**
     * Process result into standard format
     */
    async processResult(response, model) {
        const images = [];
        // Get sample data - either from result.sample or direct sample
        const sampleData = response.result?.sample || response.sample;
        if (sampleData) {
            // Check if it's a URL or base64 data
            if (sampleData.startsWith('http://') || sampleData.startsWith('https://')) {
                // It's a URL - fetch the image
                const imageResponse = await fetch(sampleData);
                const arrayBuffer = await imageResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                images.push({
                    dataUrl: this.bufferToDataUrl(buffer, 'image/png'),
                    format: 'png'
                });
            }
            else {
                // It's base64 data
                images.push({
                    dataUrl: `data:image/png;base64,${sampleData}`,
                    format: 'png'
                });
            }
        }
        if (images.length === 0) {
            throw new ProviderError('No image in BFL response', this.name, false);
        }
        return {
            images,
            provider: this.name,
            model,
            warnings: model.includes('ultra') ? ['Ultra-high resolution image generated'] : undefined
        };
    }
}
//# sourceMappingURL=bfl.js.map
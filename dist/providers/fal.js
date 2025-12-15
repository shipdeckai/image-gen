import { ImageProvider } from './base.js';
import { ProviderError } from '../types.js';
import { logger } from '../util/logger.js';
/**
 * Fal.ai Provider
 *
 * Key features:
 * - Ultra-fast generation (50-300ms) - fastest in the industry
 * - Serverless architecture with automatic scaling
 * - Wide variety of open-source models
 * - Real-time generation capabilities
 * - Extremely cost-effective
 *
 * Excellent for:
 * - Rapid prototyping and iteration
 * - Real-time applications
 * - High-volume generation needs
 * - Cost-sensitive projects
 */
export class FalProvider extends ImageProvider {
    name = 'FAL';
    baseUrl = 'https://fal.run';
    constructor() {
        super();
    }
    getApiKey() {
        return process.env.FAL_API_KEY;
    }
    isConfigured() {
        return !!this.getApiKey();
    }
    getRequiredEnvVars() {
        return ['FAL_API_KEY'];
    }
    getCapabilities() {
        return {
            supportsGenerate: true,
            supportsEdit: true, // FLUX.2 supports editing
            supportsVariations: true,
            supportsUpscale: true,
            supportsControlNet: true,
            supportsCharacterConsistency: false,
            supportsCustomModels: false,
            maxWidth: 1536,
            maxHeight: 1536,
            defaultModel: 'flux-2-pro', // FLUX.2 - Best quality
            availableModels: [
                // FLUX.2 models (NEW - Best quality, better text rendering)
                'flux-2-pro', // Maximum quality, exceptional photorealism
                'flux-2-flex', // Adjustable steps/guidance, enhanced typography
                // Legacy FLUX 1.x models (kept for compatibility)
                'flux-realism', // Photorealistic
                'flux-pro', // High quality
                // Other models
                'realvisxl-v4', // Ultra-realistic
                'stable-diffusion-v3', // Latest SD
                'animagine-xl', // Anime style
                'playground-v2', // Creative
                'fast-sdxl', // 50-100ms generation (lower quality)
                'fast-lightning-sdxl' // Even faster (lowest quality)
            ]
        };
    }
    async generate(input) {
        // Validate API key
        const apiKey = this.getApiKey();
        if (!this.validateApiKey(apiKey)) {
            throw new ProviderError('FAL_API_KEY not configured or invalid', this.name, false);
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
        // Execute with retry logic
        return this.executeWithRetry(async () => {
            const controller = this.createTimeout(60000);
            try {
                const model = this.getModelEndpoint(input.model);
                const requestBody = this.buildRequestBody(input, model);
                // Fal.ai uses a queue system for async generation
                const queueResponse = await fetch(`${this.baseUrl}/${model}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Key ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                if (!queueResponse.ok) {
                    const error = await queueResponse.text();
                    throw new ProviderError(`Fal.ai API error: ${error}`, this.name, queueResponse.status >= 500);
                }
                const result = await queueResponse.json();
                // Fal.ai can return results immediately for fast models
                if (result.images) {
                    const processedResult = await this.processResult(result, input);
                    this.cacheResult(cacheKey, processedResult);
                    return processedResult;
                }
                // For slower models, poll the request ID
                if (result.request_id) {
                    const processedResult = await this.pollForResult(result.request_id, model, input, controller, apiKey);
                    this.cacheResult(cacheKey, processedResult);
                    return processedResult;
                }
                throw new ProviderError('Unexpected response format from Fal.ai', this.name, false);
            }
            catch (error) {
                if (error instanceof ProviderError) {
                    throw error;
                }
                const message = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Fal.ai generation failed: ${message}`);
                throw new ProviderError(`Fal.ai generation failed: ${message}`, this.name, true, error);
            }
            finally {
                // Cleanup controller
                this.cleanupController(controller);
            }
        });
    }
    async edit(_input) {
        throw new ProviderError('Fal.ai does not currently support image editing', this.name, false);
    }
    getModelEndpoint(modelName) {
        // Map to Fal.ai model endpoints
        const modelMap = {
            // FLUX.2 models (NEW)
            'flux-2-pro': 'fal-ai/flux-2-pro',
            'flux-2-flex': 'fal-ai/flux-2-flex',
            // Legacy FLUX 1.x models
            'fast-sdxl': 'fal-ai/fast-sdxl',
            'fast-lightning-sdxl': 'fal-ai/fast-lightning-sdxl',
            'flux-pro': 'fal-ai/flux-pro',
            'flux-realism': 'fal-ai/flux-realism',
            'stable-diffusion-v3': 'fal-ai/stable-diffusion-v3-medium',
            'animagine-xl': 'fal-ai/animagine-xl-v31',
            'playground-v2': 'fal-ai/playground-v25',
            'realvisxl-v4': 'fal-ai/realvisxl-v4'
        };
        if (modelName && modelMap[modelName]) {
            return modelMap[modelName];
        }
        // Default to flux-2-pro for best quality
        return modelMap['flux-2-pro'];
    }
    buildRequestBody(input, model) {
        // Determine default steps based on model type
        let defaultSteps = 25;
        if (model.includes('fast')) {
            defaultSteps = 8;
        }
        else if (model.includes('flux-2')) {
            // FLUX.2 models support adjustable steps (10-50)
            defaultSteps = 28; // Good balance of quality/speed
        }
        const body = {
            prompt: input.prompt,
            num_inference_steps: input.steps || defaultSteps,
            guidance_scale: input.guidance || 3.5,
            num_images: 1,
            enable_safety_checker: true,
            expand_prompt: true, // Use Fal's prompt enhancement
            format: 'png'
        };
        // Handle dimensions based on model
        if (model.includes('flux')) {
            // Flux models (1.x and 2.x) support flexible dimensions
            body.image_size = {
                width: input.width || 1024,
                height: input.height || 1024
            };
        }
        else {
            // SDXL models use preset sizes
            body.image_size = this.mapToPresetSize(input.width, input.height);
        }
        if (input.seed !== undefined) {
            body.seed = input.seed;
        }
        // Model-specific parameters
        if (model.includes('fast')) {
            body.enable_lcm = true; // Enable LCM for even faster generation
            body.num_inference_steps = Math.min(input.steps || 4, 8); // Max 8 for fast models
        }
        else if (model.includes('flux-2-flex')) {
            // FLUX.2 [flex] supports adjustable steps (10-50) and guidance scale
            body.num_inference_steps = Math.max(10, Math.min(input.steps || 28, 50));
        }
        return body;
    }
    mapToPresetSize(width, height) {
        // Map to closest SDXL preset size
        const targetWidth = width || 1024;
        const targetHeight = height || 1024;
        const aspectRatio = targetWidth / targetHeight;
        if (aspectRatio > 1.7) {
            return 'landscape_16_9';
        }
        else if (aspectRatio > 1.3) {
            return 'landscape_4_3';
        }
        else if (aspectRatio < 0.6) {
            return 'portrait_9_16';
        }
        else if (aspectRatio < 0.8) {
            return 'portrait_3_4';
        }
        else {
            return 'square';
        }
    }
    async pollForResult(requestId, model, input, _controller, apiKey) {
        const maxAttempts = 30;
        const initialDelay = 100; // Fast models start with short delay
        const maxDelay = 5000;
        for (let attempts = 0; attempts < maxAttempts; attempts++) {
            const statusResponse = await fetch(`${this.baseUrl}/${model}/requests/${requestId}`, {
                headers: {
                    'Authorization': `Key ${apiKey}`
                }
            });
            if (!statusResponse.ok) {
                throw new ProviderError('Failed to check generation status', this.name, true);
            }
            const status = await statusResponse.json();
            if (status.status === 'COMPLETED' && status.images) {
                return this.processResult(status, input);
            }
            else if (status.status === 'FAILED') {
                throw new ProviderError(status.error || 'Generation failed', this.name, true);
            }
            // Exponential backoff with model-specific initial delay
            const baseDelay = model.includes('fast') ? initialDelay : 500;
            const delay = Math.min(baseDelay * Math.pow(1.5, attempts), maxDelay) + Math.random() * 200;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        throw new ProviderError('Generation timed out', this.name, true);
    }
    async processResult(result, input) {
        const images = result.images || [];
        if (images.length === 0) {
            throw new ProviderError('No images returned', this.name, false);
        }
        // Download and convert images
        const imagePromises = images.map(async (img) => {
            const url = typeof img === 'string' ? img : img.url;
            const response = await fetch(url);
            if (!response.ok) {
                throw new ProviderError('Failed to download generated image', this.name, true);
            }
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const format = url.includes('.webp') ? 'webp' : 'png';
            return {
                dataUrl: `data:image/${format};base64,${base64}`,
                format: format
            };
        });
        const downloadedImages = await Promise.all(imagePromises);
        const warnings = [];
        if (result.has_nsfw_concepts?.[0]) {
            warnings.push('Content may be NSFW');
        }
        if (result.timings) {
            const time = result.timings.inference || result.timings.total;
            if (time) {
                warnings.push(`Generated in ${time.toFixed(0)}ms`);
            }
        }
        return {
            provider: this.name,
            model: input.model || 'flux-2-pro',
            images: downloadedImages,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
}
//# sourceMappingURL=fal.js.map
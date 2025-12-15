import { request } from 'undici';
import { ImageProvider } from './base.js';
import { ProviderError } from '../types.js';
import { logger } from '../util/logger.js';
/**
 * Replicate provider for various image models
 */
export class ReplicateProvider extends ImageProvider {
    name = 'REPLICATE';
    constructor() {
        super();
    }
    getApiToken() {
        return process.env.REPLICATE_API_TOKEN;
    }
    isConfigured() {
        return !!this.getApiToken();
    }
    getRequiredEnvVars() {
        return ['REPLICATE_API_TOKEN'];
    }
    getCapabilities() {
        return {
            supportsGenerate: true,
            supportsEdit: true, // FLUX.2 models support editing
            maxWidth: 2048,
            maxHeight: 2048,
            defaultModel: 'black-forest-labs/flux-2-pro',
            supportedModels: [
                // FLUX.2 models (Latest - December 2025)
                'black-forest-labs/flux-2-pro', // Best quality, 8 reference images - $0.05
                'black-forest-labs/flux-2-dev', // Open-weight, reference images - $0.025
                'black-forest-labs/flux-2-flex', // Max quality, 10 reference images - $0.05
                // FLUX 1.x models (Legacy)
                'black-forest-labs/flux-1.1-pro', // Fast pro model
                'black-forest-labs/flux-kontext-pro', // Text-based editing
                'black-forest-labs/flux-schnell', // Fast/free tier
                'black-forest-labs/flux-dev' // Open-weight 1.x
            ],
            specialFeatures: [
                'multi_reference_images', // Up to 10 reference images
                'character_consistency', // Style/character preservation
                'text_rendering', // Enhanced typography
                'high_resolution', // Up to 4MP
                'image_editing' // Built-in editing capabilities
            ]
        };
    }
    async generate(input) {
        const apiToken = this.getApiToken();
        if (!apiToken) {
            throw new ProviderError('Replicate API token not configured', this.name);
        }
        // Default to FLUX.2 Pro for best quality (December 2025)
        const model = input.model || 'black-forest-labs/flux-2-pro';
        const width = input.width || 1024;
        const height = input.height || 1024;
        logger.info(`Replicate generating image`, { model, width, height, prompt: input.prompt.slice(0, 50) });
        try {
            // Create prediction
            const prediction = await this.createPrediction(model, {
                prompt: input.prompt,
                width,
                height,
                num_outputs: 1,
                ...(input.seed !== undefined && { seed: input.seed }),
                ...(input.guidance !== undefined && { guidance_scale: input.guidance }),
                ...(input.steps !== undefined && { num_inference_steps: input.steps })
            }, apiToken);
            // Poll for completion
            const result = await this.pollPrediction(prediction.id, apiToken);
            if (result.status === 'failed') {
                throw new ProviderError(`Replicate model failed: ${result.error}`, this.name, false);
            }
            // Download and convert images
            // Output can be: array of URLs, single URL string, or FileOutput object
            let outputUrls;
            if (Array.isArray(result.output)) {
                outputUrls = result.output;
            }
            else if (typeof result.output === 'string') {
                outputUrls = [result.output];
            }
            else if (result.output && typeof result.output === 'object') {
                // FileOutput object - extract URL
                const url = result.output.url || result.output;
                outputUrls = [typeof url === 'string' ? url : String(url)];
            }
            else {
                throw new ProviderError('Unexpected output format from Replicate', this.name, false);
            }
            const images = await Promise.all(outputUrls.map(async (url) => {
                const dataUrl = await this.downloadImage(url);
                return {
                    dataUrl,
                    format: 'png'
                };
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
            throw new ProviderError(`Replicate request failed: ${message}`, this.name, isRetryable, error);
        }
    }
    async edit(_input) {
        throw new ProviderError('Replicate provider does not support direct image editing. Please use generate with an img2img model instead.', this.name, false);
    }
    /**
     * Create a new prediction
     */
    async createPrediction(model, input, apiToken) {
        const controller = this.createTimeout();
        // Official models use a different endpoint: /models/{owner}/{name}/predictions
        // Community models use: /predictions with a version parameter
        const isOfficial = this.isOfficialModel(model);
        let url;
        let requestBody;
        if (isOfficial) {
            // Official models: use /models/{owner}/{name}/predictions endpoint
            // No version needed - Replicate handles it automatically
            url = `https://api.replicate.com/v1/models/${model}/predictions`;
            requestBody = { input };
        }
        else {
            // Community models: use /predictions endpoint with version
            url = 'https://api.replicate.com/v1/predictions';
            const version = await this.getModelVersion(model, apiToken);
            if (!version) {
                throw new ProviderError(`Could not find version for model: ${model}`, this.name, false);
            }
            requestBody = { version, input };
        }
        const { statusCode, body } = await request(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait' // Wait for result if fast enough
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        const response = await body.json();
        if (statusCode !== 201) {
            const message = response.detail || `Replicate API error: ${statusCode}`;
            const isRetryable = statusCode >= 500 || statusCode === 429;
            throw new ProviderError(message, this.name, isRetryable, response);
        }
        return response;
    }
    /**
     * Poll prediction status until complete
     */
    async pollPrediction(id, apiToken, maxAttempts = 60) {
        for (let i = 0; i < maxAttempts; i++) {
            const controller = this.createTimeout(10000);
            const { statusCode, body } = await request(`https://api.replicate.com/v1/predictions/${id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiToken}`
                },
                signal: controller.signal
            });
            const response = await body.json();
            if (statusCode !== 200) {
                throw new ProviderError(`Failed to get prediction status: ${statusCode}`, this.name, true);
            }
            if (response.status === 'succeeded' || response.status === 'failed') {
                return response;
            }
            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new ProviderError('Prediction timed out after 60 seconds', this.name, true);
    }
    /**
     * Check if this is an official model that uses the model parameter
     */
    isOfficialModel(model) {
        const officialModels = [
            'black-forest-labs/flux-2-pro',
            'black-forest-labs/flux-2-dev',
            'black-forest-labs/flux-2-flex',
            'black-forest-labs/flux-1.1-pro',
            'black-forest-labs/flux-kontext-pro',
            'black-forest-labs/flux-schnell',
            'black-forest-labs/flux-dev'
        ];
        return officialModels.includes(model);
    }
    /**
     * Get the latest version ID for a model
     */
    async getModelVersion(model, apiToken) {
        // For official models (black-forest-labs/*), use the model name directly
        // Replicate handles version resolution automatically for official models
        // For community models, we fetch the latest version dynamically
        // If it's an official model, return null to use model name directly
        if (this.isOfficialModel(model)) {
            return null;
        }
        // Legacy hardcoded versions for community models
        const knownVersions = {
            'stability-ai/sdxl': '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
            'lucataco/sdxl-lightning-4step': '6f7a773af6fc3e8de9d5a3c00be77c17308914bf67772726aff83496ba1e3bbe'
        };
        if (knownVersions[model]) {
            return knownVersions[model];
        }
        // For unknown models, try to get the latest version
        const controller = this.createTimeout();
        const [owner, name] = model.split('/');
        const { statusCode, body } = await request(`https://api.replicate.com/v1/models/${owner}/${name}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken}`
            },
            signal: controller.signal
        });
        if (statusCode !== 200) {
            throw new ProviderError(`Failed to get model info for ${model}`, this.name, false);
        }
        const response = await body.json();
        return response.latest_version?.id || response.default_version?.id;
    }
    /**
     * Download image from URL and convert to data URL
     */
    async downloadImage(url) {
        const controller = this.createTimeout(30000);
        const { statusCode, body } = await request(url, {
            method: 'GET',
            signal: controller.signal
        });
        if (statusCode !== 200) {
            throw new ProviderError(`Failed to download image: ${statusCode}`, this.name, true);
        }
        const buffer = await body.arrayBuffer();
        return this.bufferToDataUrl(Buffer.from(buffer), 'image/png');
    }
}
//# sourceMappingURL=replicate.js.map
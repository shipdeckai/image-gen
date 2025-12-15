import { NotImplementedError, ProviderError } from '../types.js';
import { logger } from '../util/logger.js';
// Constants for security and performance
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB max image size
const MAX_PROMPT_LENGTH = 4000; // Max prompt length
const API_KEY_MIN_LENGTH = 10; // Minimum API key length
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
// Cache for responses
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
/**
 * Abstract base class for image generation providers
 */
export class ImageProvider {
    /**
     * Generate images from text prompt
     * @param input Generation parameters
     * @returns Promise resolving to generated images
     */
    async generate(_input) {
        throw new NotImplementedError(`${this.name} provider does not implement generate()`);
    }
    /**
     * Edit existing image with text prompt
     * @param input Edit parameters including base image
     * @returns Promise resolving to edited images
     */
    async edit(_input) {
        throw new NotImplementedError(`${this.name} provider does not implement edit()`);
    }
    /**
     * Get provider-specific capabilities
     */
    getCapabilities() {
        return {
            supportsGenerate: true,
            supportsEdit: false
        };
    }
    /**
     * Helper to convert image buffer to data URL
     */
    bufferToDataUrl(buffer, mimeType) {
        const base64 = buffer.toString('base64');
        return `data:${mimeType};base64,${base64}`;
    }
    /**
     * Helper to extract buffer from data URL with size validation
     */
    dataUrlToBuffer(dataUrl) {
        const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid data URL format');
        }
        const buffer = Buffer.from(matches[2], 'base64');
        // Security: Validate buffer size
        if (buffer.length > MAX_IMAGE_SIZE) {
            throw new ProviderError(`Image size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`, this.name, false);
        }
        return {
            mimeType: matches[1],
            buffer
        };
    }
    /**
     * Helper to get buffer from either a data URL or file path
     * Supports:
     * - data:image/png;base64,... (data URLs)
     * - /path/to/file.png (absolute file paths)
     * - file:///path/to/file.png (file URLs)
     */
    async getImageBuffer(input) {
        // Check if it's a data URL
        if (input.startsWith('data:')) {
            return this.dataUrlToBuffer(input);
        }
        // Handle file paths or file:// URLs
        let filePath = input;
        if (input.startsWith('file://')) {
            // Convert file:// URL to path
            filePath = input.replace('file://', '');
        }
        // Load file from disk
        const fs = await import('fs/promises');
        const path = await import('path');
        try {
            const buffer = await fs.readFile(filePath);
            // Security: Validate buffer size
            if (buffer.length > MAX_IMAGE_SIZE) {
                throw new ProviderError(`Image size ${(buffer.length / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`, this.name, false);
            }
            // Determine mime type from extension
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.webp': 'image/webp',
                '.gif': 'image/gif'
            };
            const mimeType = mimeTypes[ext] || 'image/png';
            return {
                buffer,
                mimeType
            };
        }
        catch (error) {
            throw new ProviderError(`Failed to load image from path: ${filePath}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`, this.name, false);
        }
    }
    /**
     * Helper to detect image dimensions from buffer, data URL, or file path
     * Uses sharp for accurate dimension detection
     */
    async detectImageDimensions(input) {
        try {
            const sharp = (await import('sharp')).default;
            // Get the buffer first
            const { buffer } = await this.getImageBuffer(input);
            // Use sharp to get metadata
            const metadata = await sharp(buffer).metadata();
            if (!metadata.width || !metadata.height) {
                throw new ProviderError('Could not detect image dimensions', this.name, false);
            }
            return {
                width: metadata.width,
                height: metadata.height
            };
        }
        catch (error) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw new ProviderError(`Failed to detect image dimensions: ${error instanceof Error ? error.message : 'Unknown error'}`, this.name, false);
        }
    }
    /**
     * Helper to create timeout with AbortController and cleanup
     */
    createTimeout(ms = DEFAULT_TIMEOUT) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        // Store cleanup function on the controller for manual cleanup
        controller.cleanup = () => clearTimeout(timeoutId);
        return controller;
    }
    /**
     * Cleanup AbortController resources
     */
    cleanupController(controller) {
        if (controller.cleanup) {
            controller.cleanup();
        }
    }
    /**
     * Validate API key
     */
    validateApiKey(key) {
        if (!key)
            return false;
        // Check minimum length
        if (key.length < API_KEY_MIN_LENGTH) {
            logger.error(`API key for ${this.name} is too short`);
            return false;
        }
        // Allow test keys in test environment
        const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST;
        if (isTestEnv && key.startsWith('test-')) {
            return true;
        }
        // Check for common placeholder values
        const placeholders = ['your-api-key', 'xxx', 'placeholder', 'test', 'demo'];
        if (placeholders.some(p => key.toLowerCase().includes(p))) {
            logger.error(`API key for ${this.name} appears to be a placeholder`);
            return false;
        }
        return true;
    }
    /**
     * Validate prompt input
     */
    validatePrompt(prompt) {
        if (!prompt || prompt.trim().length === 0) {
            throw new ProviderError('Prompt cannot be empty', this.name, false);
        }
        if (prompt.length > MAX_PROMPT_LENGTH) {
            throw new ProviderError(`Prompt length ${prompt.length} exceeds maximum allowed length of ${MAX_PROMPT_LENGTH}`, this.name, false);
        }
    }
    /**
     * Check rate limit
     */
    async checkRateLimit() {
        const now = Date.now();
        const key = this.name;
        const limit = rateLimitMap.get(key);
        if (limit) {
            if (now < limit.resetTime) {
                if (limit.count >= MAX_REQUESTS_PER_WINDOW) {
                    const waitTime = Math.ceil((limit.resetTime - now) / 1000);
                    throw new ProviderError(`Rate limit exceeded for ${this.name}. Please wait ${waitTime} seconds.`, this.name, true);
                }
                limit.count++;
            }
            else {
                // Reset window
                rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
            }
        }
        else {
            rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        }
    }
    /**
     * Get cached result if available
     */
    getCachedResult(cacheKey) {
        const cached = responseCache.get(cacheKey);
        if (cached) {
            const age = Date.now() - cached.timestamp;
            if (age < CACHE_TTL) {
                logger.debug(`Cache hit for ${this.name}: ${cacheKey}`);
                return cached.result;
            }
            else {
                // Expired, remove from cache
                responseCache.delete(cacheKey);
            }
        }
        return null;
    }
    /**
     * Cache result
     */
    cacheResult(cacheKey, result) {
        responseCache.set(cacheKey, { result, timestamp: Date.now() });
        // Cleanup old cache entries
        if (responseCache.size > 100) {
            const now = Date.now();
            for (const [key, value] of responseCache.entries()) {
                if (now - value.timestamp > CACHE_TTL) {
                    responseCache.delete(key);
                }
            }
        }
    }
    /**
     * Execute with retry logic and exponential backoff
     */
    async executeWithRetry(fn, retries = MAX_RETRIES) {
        let lastError;
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error;
                // Don't retry non-retryable errors
                if (error instanceof ProviderError && !error.isRetryable) {
                    throw error;
                }
                // Calculate exponential backoff
                if (attempt < retries - 1) {
                    const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), 10000);
                    logger.debug(`Retry attempt ${attempt + 1}/${retries} for ${this.name} after ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new ProviderError(`Failed after ${retries} retries`, this.name, false);
    }
    /**
     * Generate cache key from input
     */
    generateCacheKey(input) {
        const data = {
            provider: this.name,
            prompt: input.prompt,
            model: input.model,
            ...('width' in input ? { width: input.width, height: input.height } : {}),
            ...('seed' in input ? { seed: input.seed } : {})
        };
        return JSON.stringify(data);
    }
}
//# sourceMappingURL=base.js.map
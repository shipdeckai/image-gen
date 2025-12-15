import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Abstract base class for image generation providers
 */
export declare abstract class ImageProvider {
    /**
     * Provider name for identification
     */
    abstract readonly name: string;
    /**
     * Check if the provider is configured and ready to use
     */
    abstract isConfigured(): boolean;
    /**
     * Generate images from text prompt
     * @param input Generation parameters
     * @returns Promise resolving to generated images
     */
    generate(_input: GenerateInput): Promise<ProviderResult>;
    /**
     * Edit existing image with text prompt
     * @param input Edit parameters including base image
     * @returns Promise resolving to edited images
     */
    edit(_input: EditInput): Promise<ProviderResult>;
    /**
     * Get required environment variables for this provider
     */
    abstract getRequiredEnvVars(): string[];
    /**
     * Get provider-specific capabilities
     */
    getCapabilities(): {
        supportsGenerate: boolean;
        supportsEdit: boolean;
        maxWidth?: number;
        maxHeight?: number;
        supportedModels?: string[];
    };
    /**
     * Helper to convert image buffer to data URL
     */
    protected bufferToDataUrl(buffer: Buffer, mimeType: string): string;
    /**
     * Helper to extract buffer from data URL with size validation
     */
    protected dataUrlToBuffer(dataUrl: string): {
        buffer: Buffer;
        mimeType: string;
    };
    /**
     * Helper to get buffer from either a data URL or file path
     * Supports:
     * - data:image/png;base64,... (data URLs)
     * - /path/to/file.png (absolute file paths)
     * - file:///path/to/file.png (file URLs)
     */
    protected getImageBuffer(input: string): Promise<{
        buffer: Buffer;
        mimeType: string;
    }>;
    /**
     * Helper to detect image dimensions from buffer, data URL, or file path
     * Uses sharp for accurate dimension detection
     */
    protected detectImageDimensions(input: string): Promise<{
        width: number;
        height: number;
    }>;
    /**
     * Helper to create timeout with AbortController and cleanup
     */
    protected createTimeout(ms?: number): AbortController;
    /**
     * Cleanup AbortController resources
     */
    protected cleanupController(controller: AbortController): void;
    /**
     * Validate API key
     */
    protected validateApiKey(key: string | undefined): boolean;
    /**
     * Validate prompt input
     */
    protected validatePrompt(prompt: string): void;
    /**
     * Check rate limit
     */
    protected checkRateLimit(): Promise<void>;
    /**
     * Get cached result if available
     */
    protected getCachedResult(cacheKey: string): ProviderResult | null;
    /**
     * Cache result
     */
    protected cacheResult(cacheKey: string, result: ProviderResult): void;
    /**
     * Execute with retry logic and exponential backoff
     */
    protected executeWithRetry<T>(fn: () => Promise<T>, retries?: number): Promise<T>;
    /**
     * Generate cache key from input
     */
    protected generateCacheKey(input: GenerateInput | EditInput): string;
}
//# sourceMappingURL=base.d.ts.map
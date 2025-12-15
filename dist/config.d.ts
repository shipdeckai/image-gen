import { ImageProvider } from './providers/base.js';
import { ProviderName } from './types.js';
/**
 * Provider factory and configuration management
 */
export declare class Config {
    private static providers;
    /**
     * Lazy create a provider only when needed
     */
    private static createProvider;
    /**
     * Get a provider by name
     */
    static getProvider(name: string): ImageProvider | undefined;
    /**
     * Get all registered providers
     */
    static getAllProviders(): Map<ProviderName, ImageProvider>;
    /**
     * Get list of configured providers
     */
    static getConfiguredProviders(): ProviderName[];
    /**
     * Get list of configured providers that support editing
     */
    static getConfiguredEditProviders(): ProviderName[];
    /**
     * Get default provider based on env or fallback chain
     */
    static getDefaultProvider(): ImageProvider;
    /**
     * Get provider with fallback support
     */
    static getProviderWithFallback(requestedName?: string, prompt?: string): ImageProvider;
    /**
     * Check if required environment variables are set
     */
    static requireEnv(keys: string[]): void;
    /**
     * Get provider status for config.providers tool
     */
    static getProviderStatus(): Array<{
        name: string;
        configured: boolean;
        requiredEnvVars: string[];
        capabilities: ReturnType<ImageProvider['getCapabilities']>;
    }>;
}
//# sourceMappingURL=config.d.ts.map
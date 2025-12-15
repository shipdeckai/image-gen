import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Black Forest Labs (Flux) provider for high-quality image generation
 * Documentation: https://docs.bfl.ai/
 */
export declare class BFLProvider extends ImageProvider {
    readonly name = "BFL";
    constructor();
    private getApiKey;
    isConfigured(): boolean;
    getRequiredEnvVars(): string[];
    getCapabilities(): {
        supportsGenerate: boolean;
        supportsEdit: boolean;
        maxWidth: number;
        maxHeight: number;
        defaultModel: string;
        supportedModels: string[];
        specialFeatures: string[];
    };
    generate(input: GenerateInput): Promise<ProviderResult>;
    edit(input: EditInput): Promise<ProviderResult>;
    /**
     * Get API endpoint for model
     */
    private getEndpointForModel;
    /**
     * Calculate aspect ratio string from width and height
     * Kontext supports ratios from 3:7 to 7:3
     */
    private calculateAspectRatio;
    /**
     * Poll for async result with exponential backoff
     */
    private pollForResult;
    /**
     * Process result into standard format
     */
    private processResult;
}
//# sourceMappingURL=bfl.d.ts.map
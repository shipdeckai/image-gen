import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Replicate provider for various image models
 */
export declare class ReplicateProvider extends ImageProvider {
    readonly name = "REPLICATE";
    constructor();
    private getApiToken;
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
    edit(_input: EditInput): Promise<ProviderResult>;
    /**
     * Create a new prediction
     */
    private createPrediction;
    /**
     * Poll prediction status until complete
     */
    private pollPrediction;
    /**
     * Check if this is an official model that uses the model parameter
     */
    private isOfficialModel;
    /**
     * Get the latest version ID for a model
     */
    private getModelVersion;
    /**
     * Download image from URL and convert to data URL
     */
    private downloadImage;
}
//# sourceMappingURL=replicate.d.ts.map
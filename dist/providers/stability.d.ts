import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Stability AI provider for Stable Diffusion models
 */
export declare class StabilityProvider extends ImageProvider {
    readonly name = "STABILITY";
    constructor();
    private getApiKey;
    isConfigured(): boolean;
    getRequiredEnvVars(): string[];
    getCapabilities(): {
        supportsGenerate: boolean;
        supportsEdit: boolean;
        maxWidth: number;
        maxHeight: number;
        supportedModels: string[];
    };
    generate(input: GenerateInput): Promise<ProviderResult>;
    edit(input: EditInput): Promise<ProviderResult>;
    /**
     * Get aspect ratio string for Stability API
     */
    private getAspectRatio;
}
//# sourceMappingURL=stability.d.ts.map
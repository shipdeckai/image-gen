import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
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
export declare class FalProvider extends ImageProvider {
    readonly name = "FAL";
    private baseUrl;
    constructor();
    private getApiKey;
    isConfigured(): boolean;
    getRequiredEnvVars(): string[];
    getCapabilities(): {
        supportsGenerate: boolean;
        supportsEdit: boolean;
        supportsVariations: boolean;
        supportsUpscale: boolean;
        supportsControlNet: boolean;
        supportsCharacterConsistency: boolean;
        supportsCustomModels: boolean;
        maxWidth: number;
        maxHeight: number;
        defaultModel: string;
        availableModels: string[];
    };
    generate(input: GenerateInput): Promise<ProviderResult>;
    edit(_input: EditInput): Promise<ProviderResult>;
    private getModelEndpoint;
    private buildRequestBody;
    private mapToPresetSize;
    private pollForResult;
    private processResult;
}
//# sourceMappingURL=fal.d.ts.map
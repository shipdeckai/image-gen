import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Ideogram provider for image generation with exceptional text rendering
 * Documentation: https://developer.ideogram.ai/
 */
export declare class IdeogramProvider extends ImageProvider {
    readonly name = "IDEOGRAM";
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
        supportedFormats: readonly ["png", "jpg"];
        specialFeatures: string[];
        notes: string[];
    };
    generate(input: GenerateInput): Promise<ProviderResult>;
    edit(input: EditInput): Promise<ProviderResult>;
    /**
     * Calculate aspect ratio from dimensions (legacy V1/V2 format)
     */
    private calculateAspectRatio;
    /**
     * Calculate aspect ratio from dimensions (V3 format: "1x1", "16x9", etc.)
     */
    private calculateAspectRatioV3;
    /**
     * Detect if prompt is text-heavy (logos, posters, etc.)
     */
    private detectTextRequest;
    /**
     * Detect style preset based on prompt
     */
    private detectStylePreset;
}
//# sourceMappingURL=ideogram.d.ts.map
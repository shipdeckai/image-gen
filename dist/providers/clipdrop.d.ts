import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Clipdrop Provider (by Stability AI)
 *
 * Key features:
 * - Advanced image editing and post-processing
 * - Background removal and replacement
 * - Image upscaling and enhancement
 * - Object removal and cleanup
 * - Sketch to image conversion
 *
 * Excellent for:
 * - Post-processing generated images
 * - Creating product shots with transparent backgrounds
 * - Enhancing and upscaling images
 * - Quick edits and cleanup
 */
export declare class ClipdropProvider extends ImageProvider {
    readonly name = "CLIPDROP";
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
        supportsBackgroundRemoval: boolean;
        supportsObjectRemoval: boolean;
        supportsTextRemoval: boolean;
        supportsUncrop: boolean;
        maxWidth: number;
        maxHeight: number;
        defaultModel: string;
        availableModels: string[];
    };
    generate(input: GenerateInput): Promise<ProviderResult>;
    edit(input: EditInput): Promise<ProviderResult>;
    private selectEndpoint;
    private determineEditType;
    private getEditEndpoint;
}
//# sourceMappingURL=clipdrop.d.ts.map
import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Leonardo.AI Provider
 *
 * Key features:
 * - Character consistency across multiple images (crucial for carousels)
 * - Custom model training API
 * - Multiple fine-tuned models (DreamShaper, RPG, PhotoReal, etc.)
 * - ControlNet for precise pose control
 * - Elements system for style mixing
 *
 * Excellent for:
 * - Social media carousels with consistent characters
 * - Game assets and concept art
 * - Custom branded content with trained models
 * - Artistic illustrations with consistent style
 */
export declare class LeonardoProvider extends ImageProvider {
    readonly name = "LEONARDO";
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
    private getModelId;
    private mapToPresetStyle;
}
//# sourceMappingURL=leonardo.d.ts.map
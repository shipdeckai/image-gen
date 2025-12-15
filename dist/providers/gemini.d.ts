import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Google Gemini provider using Gemini 2.5 Flash Image for generation and editing
 * Documentation: https://ai.google.dev/gemini-api/docs/image-generation
 */
export declare class GeminiProvider extends ImageProvider {
    readonly name = "GEMINI";
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
        supportedAspectRatios: string[];
        supportedSizes: string[];
        specialFeatures: string[];
    };
    generate(input: GenerateInput): Promise<ProviderResult>;
    /**
     * Generate with Imagen 4 API
     */
    private generateWithImagen;
    /**
     * Generate with Gemini multimodal API (legacy)
     */
    private generateWithGemini;
    /**
     * Calculate aspect ratio string from dimensions
     */
    private calculateAspectRatio;
    edit(input: EditInput): Promise<ProviderResult>;
    /**
     * Extract format from MIME type
     */
    private extractFormat;
}
//# sourceMappingURL=gemini.d.ts.map
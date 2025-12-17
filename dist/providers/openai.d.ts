import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * OpenAI DALL-E provider for image generation
 */
export declare class OpenAIProvider extends ImageProvider {
    readonly name = "OPENAI";
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
     * Map width/height to OpenAI size strings
     * gpt-image-1.5/1 supports: 1024x1024, 1536x1024, 1024x1536
     * DALL-E 3 supports: 1024x1024, 1792x1024, 1024x1792
     */
    private mapSize;
}
//# sourceMappingURL=openai.d.ts.map
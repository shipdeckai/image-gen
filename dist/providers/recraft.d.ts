/**
 * Recraft V3 Provider
 * #1 globally ranked image generation model (ELO 1172, 72% win rate)
 *
 * Unique Features:
 * - Vector generation (SVG output) - ONLY provider with this capability
 * - Perfect text rendering (guaranteed flawless)
 * - Superior anatomical accuracy
 * - Both raster and vector image generation
 *
 * Best for:
 * - Logo design and branding
 * - Graphic design and marketing materials
 * - Text-heavy images (posters, packaging)
 * - Print-ready designs (vector output)
 * - Professional design work
 */
import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
export declare class RecraftProvider extends ImageProvider {
    readonly name = "RECRAFT";
    private apiKey;
    private readonly baseUrl;
    constructor();
    isConfigured(): boolean;
    getRequiredEnvVars(): string[];
    getCapabilities(): {
        supportsGenerate: boolean;
        supportsEdit: boolean;
        maxWidth: number;
        maxHeight: number;
        supportedModels: string[];
        notes: string[];
    };
    generate(input: GenerateInput): Promise<ProviderResult>;
    edit(_input: EditInput): Promise<ProviderResult>;
}
//# sourceMappingURL=recraft.d.ts.map
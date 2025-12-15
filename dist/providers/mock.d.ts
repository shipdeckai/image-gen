import { ImageProvider } from './base.js';
import { GenerateInput, EditInput, ProviderResult } from '../types.js';
/**
 * Mock provider for testing without API keys
 * Returns small gradient PNG images
 */
export declare class MockProvider extends ImageProvider {
    readonly name = "MOCK";
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
     * Create a valid PNG with gradient based on prompt hash
     */
    private createGradientPNG;
    /**
     * Create a PNG chunk with proper CRC
     */
    private createChunk;
    /**
     * Calculate CRC32 checksum (PNG standard)
     */
    private crc32;
    /**
     * Generate CRC32 lookup table
     */
    private makeCRCTable;
}
//# sourceMappingURL=mock.d.ts.map
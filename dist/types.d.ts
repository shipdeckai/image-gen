import { z } from 'zod';
export declare enum ResponseFormat {
    MARKDOWN = "markdown",
    JSON = "json"
}
export declare const GenerateInputSchema: z.ZodObject<{
    prompt: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    model: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    guidance: z.ZodOptional<z.ZodNumber>;
    steps: z.ZodOptional<z.ZodNumber>;
    response_format: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof ResponseFormat>>>;
}, "strict", z.ZodTypeAny, {
    prompt: string;
    provider?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    model?: string | undefined;
    seed?: number | undefined;
    guidance?: number | undefined;
    steps?: number | undefined;
    response_format?: ResponseFormat | undefined;
}, {
    prompt: string;
    provider?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    model?: string | undefined;
    seed?: number | undefined;
    guidance?: number | undefined;
    steps?: number | undefined;
    response_format?: ResponseFormat | undefined;
}>;
export declare const EditInputSchema: z.ZodObject<{
    prompt: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    baseImage: z.ZodString;
    maskImage: z.ZodOptional<z.ZodString>;
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    model: z.ZodOptional<z.ZodString>;
    response_format: z.ZodOptional<z.ZodDefault<z.ZodNativeEnum<typeof ResponseFormat>>>;
}, "strict", z.ZodTypeAny, {
    prompt: string;
    baseImage: string;
    provider?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    model?: string | undefined;
    response_format?: ResponseFormat | undefined;
    maskImage?: string | undefined;
}, {
    prompt: string;
    baseImage: string;
    provider?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    model?: string | undefined;
    response_format?: ResponseFormat | undefined;
    maskImage?: string | undefined;
}>;
export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type EditInput = z.infer<typeof EditInputSchema>;
export interface ProviderResult {
    images: Array<{
        dataUrl: string;
        format: 'png' | 'jpg' | 'jpeg' | 'webp' | 'svg';
    }>;
    provider: string;
    model?: string;
    warnings?: string[];
}
export type ProviderName = 'OPENAI' | 'STABILITY' | 'REPLICATE' | 'GEMINI' | 'IDEOGRAM' | 'BFL' | 'LEONARDO' | 'FAL' | 'CLIPDROP' | 'MOCK' | 'RECRAFT' | 'FAL_FLUX' | 'QWEN';
export declare class ProviderError extends Error {
    readonly provider: string;
    readonly isRetryable: boolean;
    readonly originalError?: unknown | undefined;
    constructor(message: string, provider: string, isRetryable?: boolean, originalError?: unknown | undefined);
}
export declare class NotImplementedError extends Error {
    constructor(message?: string);
}
//# sourceMappingURL=types.d.ts.map
/**
 * Type definitions for provider API responses
 */
export interface BFLGenerateResponse {
    id?: string;
    sample?: string;
    status?: 'Ready' | 'Failed' | 'Pending';
    result?: {
        sample: string;
    };
    error?: {
        message: string;
    };
}
export interface LeonardoGenerationJob {
    sdGenerationJob?: {
        generationId: string;
    };
}
export interface LeonardoGenerationStatus {
    generations_by_pk: {
        status: 'COMPLETE' | 'FAILED' | 'PENDING';
        generated_images?: Array<{
            url: string;
        }>;
        nsfw?: boolean;
    };
}
export interface FalGenerateResponse {
    request_id?: string;
    images?: Array<string | {
        url: string;
    }>;
    status?: 'COMPLETED' | 'FAILED' | 'PENDING';
    error?: string;
    has_nsfw_concepts?: boolean[];
    timings?: {
        inference?: number;
        total?: number;
    };
}
export interface IdeogramGenerateResponse {
    data: Array<{
        url?: string;
        base64?: string;
        seed?: number;
    }>;
    error?: {
        message: string;
    };
}
export interface ClipdropResponse {
    buffer?: Buffer;
    error?: {
        message: string;
    };
}
export interface APIErrorResponse {
    error?: {
        message: string;
        code?: string;
        details?: unknown;
    };
    message?: string;
    statusCode?: number;
}
//# sourceMappingURL=api-responses.d.ts.map
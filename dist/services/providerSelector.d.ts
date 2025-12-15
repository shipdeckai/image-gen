/**
 * Analyze prompt to detect use case with optimized O(n) complexity
 */
export declare function analyzePrompt(prompt: string): {
    useCase: string;
    confidence: number;
} | null;
/**
 * Select the best provider for a given prompt
 */
export declare function selectProvider(prompt: string, availableProviders: string[], explicitProvider?: string): string | undefined;
/**
 * Get provider recommendations for a prompt
 */
export declare function getProviderRecommendations(prompt: string): {
    primary: string[];
    secondary: string[];
    reason: string;
};
//# sourceMappingURL=providerSelector.d.ts.map
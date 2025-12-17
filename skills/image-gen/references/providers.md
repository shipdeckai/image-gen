# Provider Reference

Detailed capabilities for each image generation provider.

## Provider Comparison

| Provider | Best For | Generate | Edit | Max Size | Speed |
|----------|----------|----------|------|----------|-------|
| OpenAI | Versatile, creative | Yes | Yes | 1792x1792 | Fast |
| Stability | Photorealism | Yes | Yes | 2048x2048 | Fast |
| BFL | Ultra-high quality | Yes | Yes | 2048x2048 | Moderate |
| Ideogram | Text rendering, logos | Yes | Yes | 2048x2048 | Fast |
| FAL | Fast iterations | Yes | No | 2048x2048 | Very Fast |
| Gemini | Multimodal context | Yes | Yes | 2048x2048 | Moderate |
| Replicate | FLUX models | Yes | No | 2048x2048 | Fast |
| Clipdrop | Background removal | No | Yes | N/A | Fast |
| Leonardo | Artistic, cinematic | Yes | No | 1024x1024 | Moderate |
| Recraft | Perfect text, vectors | Yes | No | 2048x2048 | Fast |

## OpenAI (gpt-image-1.5)

**Strengths:** Superior instruction following, exceptional text rendering (especially small/dense text), detailed editing with visual consistency, world knowledge. 4x faster than previous generation.

**Models:** `gpt-image-1.5` (recommended, Dec 2025), `gpt-image-1`, `dall-e-3`, `dall-e-2`

**Dimensions:** 1024x1024, 1536x1024, 1024x1536 (gpt-image-1.5/1); 1792x1024, 1024x1792 (DALL-E 3)

**Environment:** `OPENAI_API_KEY`

## Stability AI (Stable Diffusion)

**Strengths:** Fine parameter control, mature API, img-to-img capabilities.

**Use cases:** Photorealistic images, controlled generation

**Environment:** `STABILITY_API_KEY`

## BFL (Black Forest Labs / FLUX)

**Strengths:** State-of-the-art photorealism, fine detail, texture quality, up to 10 reference images.

**Models:** `flux-2-pro` (default), `flux-2-flex`, `flux1.1-pro`, `flux1.1-pro-ultra` (4MP)

**Dimensions:** Up to 2048x2048, flexible aspect ratios

**Environment:** `BFL_API_KEY`

## Ideogram (V3)

**Strengths:** Industry-leading text-in-image quality, 50+ style presets, character reference support.

**Capabilities:** Generate, Remix, Edit, Reframe, Replace Background, Face Swapping

**Environment:** `IDEOGRAM_API_KEY`

## FAL (FLUX.2)

**Strengths:** Enhanced text rendering, adjustable steps (10-50), flexible guidance scale.

**Models:** `flux-2-pro` (default), `flux-2-flex`, `flux-realism`, `fast-sdxl`

**Speed:** 2-10s typical, sub-second for legacy models

**Environment:** `FAL_API_KEY`

## Gemini (Imagen 4)

**Strengths:** High-fidelity generation, multimodal capability, Google infrastructure.

**Models:** `imagen-4.0-generate-001` (default), `imagen-4.0-ultra-generate-001`, `imagen-4.0-fast-generate-001`

**Note:** All images include SynthID watermark. Currently only supports 1:1 aspect ratio for editing.

**Environment:** `GEMINI_API_KEY`

## Replicate (FLUX.2)

**Strengths:** Access to FLUX.2 models, many open-source models.

**Models:** `flux-2-pro` (default), `flux-2-dev`, `flux-2-flex`, `flux-kontext-pro`

**Environment:** `REPLICATE_API_TOKEN`

## Clipdrop

**Strengths:** Specialized editing - background removal, enhancement, upscaling.

**Note:** Post-processing only, not for generation.

**Environment:** `CLIPDROP_API_KEY`

## Leonardo (Subscription Required)

**Strengths:** Artistic quality, fantasy art, cinematic compositions, game assets.

**Note:** Requires active Leonardo.ai subscription beyond API key.

**Environment:** `LEONARDO_API_KEY`

## Recraft (Subscription Required)

**Strengths:** #1 globally ranked (ELO 1172), perfect text rendering, vector generation.

**Note:** Requires active Recraft subscription beyond API key.

**Environment:** `RECRAFT_API_KEY`

## Fallback Chain

When `auto` is used, providers are tried in order of quality/reliability:
1. RECRAFT (if configured)
2. BFL
3. OPENAI
4. LEONARDO (if configured)
5. IDEOGRAM
6. STABILITY
7. GEMINI
8. FAL
9. REPLICATE

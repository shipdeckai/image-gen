#!/usr/bin/env node
/**
 * CLI entry point for image generation
 * Reuses existing provider infrastructure without MCP protocol overhead
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import * as os from 'os';

import { Config } from './config.js';
import { GenerateInputSchema, EditInputSchema, ProviderError, ResponseFormat } from './types.js';
import { logger } from './util/logger.js';

// Session ID for temp file naming
const SESSION_ID = randomUUID().slice(0, 8);
const TEMP_FILE_PREFIX = `image-gen-${process.pid}-${SESSION_ID}-`;

// Parse command line arguments
function parseArgs(): {
  command: string;
  options: Record<string, string | number | boolean>;
} {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options: Record<string, string | number | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Handle boolean flags
      if (!nextArg || nextArg.startsWith('--')) {
        options[key] = true;
      } else {
        // Try to parse as number
        const num = Number(nextArg);
        options[key] = isNaN(num) ? nextArg : num;
        i++;
      }
    }
  }

  return { command, options };
}

/**
 * Get output directory for generated images
 */
async function getOutputDirectory(): Promise<string> {
  const configuredDir = process.env.IMAGE_OUTPUT_DIR;

  if (!configuredDir || configuredDir === 'cwd') {
    const dir = path.join(process.cwd(), '.image-gen');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  } else if (configuredDir === 'temp') {
    return os.tmpdir();
  } else {
    await fs.mkdir(configuredDir, { recursive: true });
    return configuredDir;
  }
}

/**
 * Generate command handler
 */
async function handleGenerate(options: Record<string, string | number | boolean>): Promise<void> {
  const input = GenerateInputSchema.parse({
    prompt: options.prompt,
    provider: options.provider || 'auto',
    width: options.width,
    height: options.height,
    model: options.model,
    seed: options.seed,
    guidance: options.guidance,
    steps: options.steps,
    response_format: options.format === 'markdown' ? ResponseFormat.MARKDOWN : ResponseFormat.JSON
  });

  // Provider selection logic
  let provider;
  if (input.provider === 'auto' || !input.provider) {
    const allConfigured = Config.getConfiguredProviders();

    // Filter providers that support the requested dimensions
    const compatibleProviders = allConfigured.filter(name => {
      const p = Config.getProvider(name);
      if (!p) return false;
      const caps = p.getCapabilities();

      if (input.width && caps.maxWidth && input.width > caps.maxWidth) {
        return false;
      }
      if (input.height && caps.maxHeight && input.height > caps.maxHeight) {
        return false;
      }
      return true;
    });

    if (compatibleProviders.length === 0) {
      throw new Error(
        `No providers support the requested dimensions (${input.width || 'default'}x${input.height || 'default'}).`
      );
    }

    const { selectProvider } = await import('./services/providerSelector.js');
    const selectedName = selectProvider(input.prompt, compatibleProviders);
    provider = selectedName ? Config.getProvider(selectedName)! : Config.getProviderWithFallback(undefined, input.prompt);
  } else {
    provider = Config.getProviderWithFallback(input.provider, input.prompt);

    // Validate explicit provider supports dimensions
    const capabilities = provider.getCapabilities();
    if (input.width && capabilities.maxWidth && input.width > capabilities.maxWidth) {
      throw new Error(`Width ${input.width} exceeds provider ${provider.name} maximum (${capabilities.maxWidth}).`);
    }
    if (input.height && capabilities.maxHeight && input.height > capabilities.maxHeight) {
      throw new Error(`Height ${input.height} exceeds provider ${provider.name} maximum (${capabilities.maxHeight}).`);
    }
  }

  logger.info(`Generating image with ${provider.name}`, { prompt: input.prompt.slice(0, 50) });

  try {
    const result = await provider.generate(input);

    // Check for large images and warn
    const warnings = [...(result.warnings || [])];

    // Save images to configured directory
    const outputDir = await getOutputDirectory();
    const savedImages = await Promise.all(result.images.map(async (img, idx) => {
      const base64Data = img.dataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const hash = createHash('md5').update(buffer).digest('hex').slice(0, 8);
      const filename = `${TEMP_FILE_PREFIX}${result.provider.toLowerCase()}-${hash}-${Date.now()}-${idx}.${img.format || 'png'}`;
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, buffer);
      return {
        path: filepath,
        format: img.format,
        size: buffer.length
      };
    }));

    const responseData = {
      success: true,
      images: savedImages,
      provider: result.provider,
      model: result.model,
      warnings: warnings.length > 0 ? warnings : undefined
    };

    // Output based on format
    if (input.response_format === ResponseFormat.MARKDOWN) {
      console.log(`# Image Generated\n`);
      console.log(`**Provider**: ${result.provider}`);
      if (result.model) console.log(`**Model**: ${result.model}`);
      console.log(`\n## Files`);
      savedImages.forEach((img, i) => {
        console.log(`- Image ${i + 1}: \`${img.path}\` (${(img.size / 1024).toFixed(1)} KB)`);
      });
      if (warnings.length > 0) {
        console.log(`\n## Warnings`);
        warnings.forEach(w => console.log(`- ${w}`));
      }
    } else {
      console.log(JSON.stringify(responseData, null, 2));
    }
  } catch (error) {
    if (error instanceof ProviderError && error.isRetryable && process.env.DISABLE_FALLBACK !== 'true') {
      // Try fallback provider
      logger.warn(`Provider ${provider.name} failed, attempting fallback`, { error });

      const fallback = Config.getDefaultProvider();
      if (fallback.name !== provider.name) {
        const result = await fallback.generate(input);

        const outputDir = await getOutputDirectory();
        const savedImages = await Promise.all(result.images.map(async (img, idx) => {
          const base64Data = img.dataUrl.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          const hash = createHash('md5').update(buffer).digest('hex').slice(0, 8);
          const filename = `${TEMP_FILE_PREFIX}${result.provider.toLowerCase()}-${hash}-${Date.now()}-${idx}.${img.format || 'png'}`;
          const filepath = path.join(outputDir, filename);
          await fs.writeFile(filepath, buffer);
          return {
            path: filepath,
            format: img.format,
            size: buffer.length
          };
        }));

        const responseData = {
          success: true,
          images: savedImages,
          provider: result.provider,
          model: result.model,
          warnings: [
            `Original provider ${provider.name} failed: ${(error as Error).message}`,
            `Fell back to ${fallback.name}`,
            ...(result.warnings || [])
          ]
        };

        console.log(JSON.stringify(responseData, null, 2));
        return;
      }
    }
    throw error;
  }
}

/**
 * Edit command handler
 */
async function handleEdit(options: Record<string, string | number | boolean>): Promise<void> {
  const input = EditInputSchema.parse({
    prompt: options.prompt,
    baseImage: options.image,
    maskImage: options.mask,
    provider: options.provider || 'auto',
    width: options.width,
    height: options.height,
    model: options.model,
    response_format: options.format === 'markdown' ? ResponseFormat.MARKDOWN : ResponseFormat.JSON
  });

  // Provider selection for edit
  let provider;
  if (input.provider === 'auto' || !input.provider) {
    const editCapableProviders = Config.getConfiguredEditProviders();
    if (editCapableProviders.length === 0) {
      throw new Error('No providers configured that support image editing.');
    }
    const { selectProvider } = await import('./services/providerSelector.js');
    const selectedName = selectProvider(input.prompt, editCapableProviders);
    provider = selectedName ? Config.getProvider(selectedName) : Config.getProviderWithFallback(undefined, input.prompt);
  } else {
    provider = Config.getProviderWithFallback(input.provider, input.prompt);
  }

  if (!provider) {
    throw new Error('No provider available for image editing');
  }

  if (!provider.getCapabilities().supportsEdit) {
    throw new Error(`Provider ${provider.name} does not support image editing.`);
  }

  logger.info(`Editing image with ${provider.name}`, { prompt: input.prompt.slice(0, 50) });

  const result = await provider.edit(input);

  // Save images to configured directory
  const outputDir = await getOutputDirectory();
  const savedImages = await Promise.all(result.images.map(async (img, idx) => {
    const base64Data = img.dataUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const hash = createHash('md5').update(buffer).digest('hex').slice(0, 8);
    const filename = `${TEMP_FILE_PREFIX}${result.provider.toLowerCase()}-edit-${hash}-${Date.now()}-${idx}.${img.format || 'png'}`;
    const filepath = path.join(outputDir, filename);
    await fs.writeFile(filepath, buffer);
    return {
      path: filepath,
      format: img.format,
      size: buffer.length
    };
  }));

  const responseData = {
    success: true,
    images: savedImages,
    provider: result.provider,
    model: result.model,
    warnings: result.warnings
  };

  if (input.response_format === ResponseFormat.MARKDOWN) {
    console.log(`# Image Edited\n`);
    console.log(`**Provider**: ${result.provider}`);
    if (result.model) console.log(`**Model**: ${result.model}`);
    console.log(`\n## Files`);
    savedImages.forEach((img, i) => {
      console.log(`- Image ${i + 1}: \`${img.path}\` (${(img.size / 1024).toFixed(1)} KB)`);
    });
  } else {
    console.log(JSON.stringify(responseData, null, 2));
  }
}

/**
 * Providers command handler
 */
function handleProviders(): void {
  const status = Config.getProviderStatus();
  console.log(JSON.stringify(status, null, 2));
}

/**
 * Health command handler
 */
function handleHealth(): void {
  console.log(JSON.stringify({ status: 'ok', version: '2.0.0' }));
}

/**
 * Help command handler
 */
function handleHelp(): void {
  console.log(`
image-gen - AI-powered image generation CLI

USAGE:
  image-gen <command> [options]

COMMANDS:
  generate    Generate an image from a text prompt
  edit        Edit an existing image with a text prompt
  providers   List all configured providers and their capabilities
  health      Check if the CLI is working

GENERATE OPTIONS:
  --prompt <text>       Text description of image to generate (required)
  --provider <name>     Provider: auto, openai, stability, bfl, ideogram, fal, etc.
  --width <pixels>      Image width (64-4096)
  --height <pixels>     Image height (64-4096)
  --model <name>        Specific model name
  --seed <number>       Random seed for reproducibility
  --guidance <number>   Guidance scale (0-30)
  --steps <number>      Inference steps (1-150)
  --format <type>       Output format: json (default) or markdown

EDIT OPTIONS:
  --prompt <text>       Edit instructions (required)
  --image <path>        Path to image to edit (required)
  --mask <path>         Path to mask image (optional)
  --provider <name>     Provider: auto, openai, stability, bfl, gemini, clipdrop
  --width <pixels>      Output width
  --height <pixels>     Output height
  --format <type>       Output format: json (default) or markdown

EXAMPLES:
  image-gen generate --prompt "A sunset over mountains"
  image-gen generate --prompt "Logo for TechCo" --provider ideogram --width 1024 --height 1024
  image-gen edit --image ./photo.png --prompt "Remove the background"
  image-gen providers
  image-gen health

ENVIRONMENT:
  Set API keys for providers you want to use:
  - OPENAI_API_KEY
  - STABILITY_API_KEY
  - BFL_API_KEY
  - IDEOGRAM_API_KEY
  - FAL_API_KEY
  - GEMINI_API_KEY
  - REPLICATE_API_TOKEN
  - CLIPDROP_API_KEY
  - LEONARDO_API_KEY
  - RECRAFT_API_KEY

  Optional configuration:
  - DEFAULT_PROVIDER=auto     Default provider selection
  - DISABLE_FALLBACK=true     Disable automatic fallback
  - IMAGE_OUTPUT_DIR=<path>   Custom output directory
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const { command, options } = parseArgs();

  try {
    switch (command) {
      case 'generate':
        if (!options.prompt) {
          console.error('Error: --prompt is required for generate command');
          process.exit(1);
        }
        await handleGenerate(options);
        break;

      case 'edit':
        if (!options.prompt) {
          console.error('Error: --prompt is required for edit command');
          process.exit(1);
        }
        if (!options.image) {
          console.error('Error: --image is required for edit command');
          process.exit(1);
        }
        await handleEdit(options);
        break;

      case 'providers':
        handleProviders();
        break;

      case 'health':
        handleHealth();
        break;

      case 'help':
      case '--help':
      case '-h':
        handleHelp();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "image-gen help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(JSON.stringify({ success: false, error: message }, null, 2));
    process.exit(1);
  }
}

main();

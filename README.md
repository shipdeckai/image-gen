# Image Gen

AI-powered image generation CLI and Claude Code plugin with multi-provider support.

## Features

- **10 AI Providers**: OpenAI, Stability, BFL FLUX, Ideogram, FAL, Gemini, Replicate, Clipdrop, Leonardo, Recraft
- **Intelligent Selection**: Auto-selects best provider based on prompt content
- **Automatic Fallback**: Smart fallback chain when providers fail
- **Image Editing**: Edit existing images with text prompts

## Installation

### As Claude Code Plugin (Recommended)

```bash
# Add to your plugin marketplace
/plugin marketplace add https://github.com/merlinrabens/image-gen-mcp

# Install the plugin
/plugin install image-gen
```

The skill activates automatically when you ask Claude to generate or edit images.

### As CLI Tool

```bash
npm install -g image-gen

# Or run directly
npx image-gen generate --prompt "A sunset over mountains"
```

### From Source

```bash
git clone https://github.com/merlinrabens/image-gen-mcp.git
cd image-gen-mcp
npm install
npm run build
npm link  # Makes 'image-gen' command available globally
```

## Configuration

Set API keys as environment variables. At minimum, configure one provider:

```bash
export OPENAI_API_KEY="sk-..."
export STABILITY_API_KEY="sk-..."
export BFL_API_KEY="..."
export IDEOGRAM_API_KEY="..."
export FAL_API_KEY="..."
export GEMINI_API_KEY="AIza..."
export REPLICATE_API_TOKEN="r8_..."
export CLIPDROP_API_KEY="..."
export LEONARDO_API_KEY="..."     # Requires subscription
export RECRAFT_API_KEY="..."      # Requires subscription
```

Optional settings:
- `DEFAULT_PROVIDER=auto` - Default provider selection
- `DISABLE_FALLBACK=true` - Prevent automatic fallback
- `IMAGE_OUTPUT_DIR=/path` - Custom output directory

## Usage

### Generate Images

```bash
image-gen generate --prompt "A serene mountain landscape at sunset"

# Specify provider and dimensions
image-gen generate --prompt "Modern logo with text 'ACME'" --provider ideogram --width 1024 --height 1024

# Additional options
image-gen generate --prompt "..." --seed 42 --guidance 7.5 --steps 50
```

### Edit Images

```bash
image-gen edit --image ./photo.png --prompt "Remove the background"

# With specific provider
image-gen edit --image ./photo.png --prompt "Add a sunset sky" --provider openai
```

### List Providers

```bash
image-gen providers
```

### Health Check

```bash
image-gen health
```

## Provider Selection Guide

| Use Case | Best Provider |
|----------|---------------|
| Text/logos/typography | `ideogram` or `recraft` |
| Photorealism | `bfl` or `stability` |
| Fast iterations | `fal` |
| General purpose | `openai` |
| Image editing | `openai`, `stability`, `bfl`, `gemini`, `clipdrop` |
| Character consistency | `leonardo` |

Use `--provider auto` (default) for intelligent selection based on prompt content.

## Output

Generated images are saved to `.image-gen/` in the current directory by default.

```json
{
  "success": true,
  "images": [
    {
      "path": ".image-gen/image-gen-12345-bfl-abc123-1234567890-0.png",
      "format": "png",
      "size": 1234567
    }
  ],
  "provider": "BFL",
  "model": "flux-2-pro"
}
```

## Plugin Structure

```
image-gen/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── skills/
│   └── image-gen/
│       ├── SKILL.md          # Skill definition
│       └── references/
│           └── providers.md  # Provider reference
├── src/
│   ├── cli.ts               # CLI entry point
│   ├── config.ts            # Provider management
│   ├── providers/           # Provider implementations
│   └── services/
│       └── providerSelector.ts
└── dist/                    # Compiled output
```

## Development

```bash
npm run dev      # Run CLI in development
npm run build    # Compile TypeScript
npm test         # Run tests
npm run typecheck
```

## API Keys

Get your API keys from:
- **OpenAI**: https://platform.openai.com/api-keys
- **Stability AI**: https://platform.stability.ai/account/keys
- **BFL**: https://api.bfl.ml/
- **Ideogram**: https://ideogram.ai/api
- **FAL**: https://fal.ai/dashboard/keys
- **Gemini**: https://aistudio.google.com/apikey
- **Replicate**: https://replicate.com/account/api-tokens
- **Clipdrop**: https://clipdrop.co/apis
- **Leonardo**: https://app.leonardo.ai/settings (subscription required)
- **Recraft**: https://www.recraft.ai/ (subscription required)

## License

MIT

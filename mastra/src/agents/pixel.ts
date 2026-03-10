import { Agent } from "@mastra/core/agent";
import { buildPixelSystemPrompt } from "../lib/pixel-guidelines.js";
import { pixelTools } from "../tools/pixel.js";

export const pixel = new Agent({
  id: "pixel",
  name: "Pixel",
  description:
    "Visual design system and asset generation agent. Produces production-ready UI packs, sprites, textures, and HUD components for Phaser and Three.js games using a design-system-first workflow.",
  instructions: buildPixelSystemPrompt(),
  model: "openrouter/anthropic/claude-sonnet-4.6",
  tools: pixelTools,
});

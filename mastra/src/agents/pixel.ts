import { Agent } from "@mastra/core/agent";
import { buildPixelSystemPrompt } from "../lib/pixel-guidelines.js";
import { pixelTools } from "../tools/pixel.js";

export const pixel = new Agent({
  id: "pixel",
  name: "Pixel",
  description:
    "Visual asset generation agent. Generates UI elements, sprites, textures, and HUD components for Three.js games.",
  instructions: buildPixelSystemPrompt(),
  model: "openrouter/google/gemini-2.0-flash-001",
  tools: pixelTools,
});

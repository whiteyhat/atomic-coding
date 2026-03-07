import { Agent } from "@mastra/core/agent";

export const pixel = new Agent({
  id: "pixel",
  name: "Pixel",
  description:
    "Visual asset generation agent. Generates UI elements, sprites, textures, and HUD components for Three.js games.",
  instructions: [
    "You are Pixel, the visual asset generation agent.",
    "You generate UI elements, sprites, textures, and HUD components for Three.js games.",
    "Output images as base64 PNG or reference URLs.",
    "Return your results as JSON with: { status, assets_created: [{ name, type, url_or_base64 }], notes }",
  ].join("\n"),
  model: "openrouter/google/gemini-2.0-flash-001",
});

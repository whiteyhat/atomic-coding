export const DEFAULT_PIXEL_IMAGE_MODEL =
  process.env.OPENROUTER_IMAGE_MODEL ??
  "google/gemini-3.1-flash-image-preview";

export const PIXEL_UI_POLISH_RULES = [
  "Keep gameplay readability above decoration. Primary stats and primary actions must stay obvious at a glance.",
  "Generate stateful UI when relevant: idle, hover, pressed, disabled, cooldown, or damage variants.",
  "Reserve clean negative space for dynamic text, score values, timers, and health numbers.",
  "Favor bold silhouettes, high local contrast, and icon shapes that remain legible on a small canvas.",
  "Match the game's genre and mood without introducing mockup chrome, browser frames, or stock-photo composition.",
  "Prefer transparent-background PNG-ready output for HUD, buttons, icons, and overlays unless a full background is requested.",
  "Use one cohesive visual language per pack: shared palette, framing logic, lighting direction, and edge treatment.",
  "Include motion cues and interaction hints in the composition: glows, bevels, hit flashes, progress notches, or focus rings.",
];

export const PIXEL_STYLE_PILLARS = [
  "Design systems over isolated assets",
  "Controller-first readability",
  "Clear visual hierarchy",
  "Deliberate motion and feedback",
  "Accessible contrast and state changes",
];

export type PixelAspectRatio =
  | "1:1"
  | "3:2"
  | "4:3"
  | "16:9"
  | "21:9"
  | "9:16";

export type PixelImageSize = "1K" | "2K" | "4K";

export interface PixelAssetPromptRequest {
  name: string;
  type: string;
  brief: string;
  usage?: string;
  textOverlay?: string | null;
  aspectRatio: PixelAspectRatio;
  imageSize: PixelImageSize;
  transparentBackground: boolean;
  polishGoals: string[];
  referenceNotes: string[];
}

export interface PixelPackContext {
  genre?: string | null;
  styleDirection?: string | null;
  packGoal?: string | null;
}

export function buildPixelSystemPrompt(): string {
  return [
    "You are Pixel, the visual asset generation agent for Atomic Coding.",
    "Use get-code-structure and read-atoms to inspect gameplay names, mechanics, and UI requirements before inventing visuals.",
    "Use generate-polished-visual-pack for every real asset deliverable. Do not pretend assets exist without calling the tool.",
    "Optimize for game UI and game readability, not marketing mockups.",
    "Treat every request as a mini design-system problem: align palette, spacing rhythm, icon language, and interaction states.",
    "When generating UI, include polished interaction thinking such as hover/pressed states, safe text zones, and contrast-aware framing.",
    "Return JSON with: { status, art_direction, assets_created: [{ name, type, url_or_base64, prompt_used, aspect_ratio, image_size, polish_notes, source_model }], notes }",
  ].join("\n");
}

export function buildPixelAssetPrompt(
  asset: PixelAssetPromptRequest,
  context: PixelPackContext
): string {
  const lines = [
    "Create a polished game art asset.",
    "",
    `Asset name: ${asset.name}`,
    `Asset type: ${asset.type}`,
    `Primary brief: ${asset.brief}`,
    `Usage context: ${asset.usage?.trim() || "General gameplay use"}`,
    `Game genre: ${context.genre?.trim() || "custom"}`,
    `Pack goal: ${context.packGoal?.trim() || "Produce cohesive production-ready game art"}`,
    `Style direction: ${context.styleDirection?.trim() || "Bold, readable, game-ready UI art with strong hierarchy"}`,
    `Target aspect ratio: ${asset.aspectRatio}`,
    `Target image size: ${asset.imageSize}`,
    `Transparent background required: ${asset.transparentBackground ? "yes" : "no"}`,
  ];

  if (asset.textOverlay?.trim()) {
    lines.push(`Exact on-asset text: ${asset.textOverlay.trim()}`);
  }

  if (asset.referenceNotes.length > 0) {
    lines.push("", "Reference notes:");
    for (const note of asset.referenceNotes) {
      lines.push(`- ${note}`);
    }
  }

  lines.push("", "Polish goals:");
  for (const goal of asset.polishGoals) {
    lines.push(`- ${goal}`);
  }

  lines.push("", "Non-negotiable polish rules:");
  for (const rule of PIXEL_UI_POLISH_RULES) {
    lines.push(`- ${rule}`);
  }

  lines.push(
    "",
    "Avoid watermarks, UI mockup frames, noisy unreadable text, and decorative clutter that harms gameplay clarity.",
    "If the asset is UI, design it like a reusable production asset rather than a one-off concept render."
  );

  return lines.join("\n");
}

export function sanitizeReferenceNotes(notes: string[]): string[] {
  const unique = new Set<string>();

  for (const note of notes) {
    const trimmed = note.trim();
    if (!trimmed) continue;
    unique.add(trimmed.replace(/\s+/g, " "));
    if (unique.size >= 8) break;
  }

  return [...unique];
}

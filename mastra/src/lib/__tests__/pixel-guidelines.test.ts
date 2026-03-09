import { describe, expect, it } from "vitest";
import {
  buildPixelAssetPrompt,
  buildPixelSystemPrompt,
  sanitizeReferenceNotes,
} from "../pixel-guidelines.js";

describe("pixel-guidelines", () => {
  it("builds a prompt with polish goals and references", () => {
    const prompt = buildPixelAssetPrompt(
      {
        name: "combat_hud",
        type: "hud",
        brief: "A futuristic combat HUD with score, shield, and objective framing.",
        usage: "Displayed during active combat encounters.",
        textOverlay: "MISSION READY",
        aspectRatio: "16:9",
        imageSize: "2K",
        transparentBackground: true,
        polishGoals: ["Clear score hierarchy", "Hover-ready button treatment"],
        referenceNotes: ["teal glass panels", "sharp hex accents"],
      },
      {
        genre: "arena-dogfighter",
        styleDirection: "sleek sci-fi cockpit UI",
        packGoal: "deliver a reusable HUD pack",
      }
    );

    expect(prompt).toContain("Asset name: combat_hud");
    expect(prompt).toContain("Game genre: arena-dogfighter");
    expect(prompt).toContain("Exact on-asset text: MISSION READY");
    expect(prompt).toContain("teal glass panels");
    expect(prompt).toContain("Hover-ready button treatment");
    expect(prompt).toContain("Non-negotiable polish rules:");
  });

  it("sanitizes and deduplicates reference notes", () => {
    expect(
      sanitizeReferenceNotes([
        "  crisp neon  ",
        "crisp neon",
        "",
        "panel bevels",
      ])
    ).toEqual(["crisp neon", "panel bevels"]);
  });

  it("documents the required generation tool in the system prompt", () => {
    expect(buildPixelSystemPrompt()).toContain(
      "generate-polished-visual-pack"
    );
  });
});

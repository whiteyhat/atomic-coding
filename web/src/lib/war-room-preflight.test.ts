import { describe, expect, it } from "vitest";
import type { AssetModel } from "./types";
import {
  buildWarRoomPreflightInstructions,
  composeWarRoomPrompt,
  getFallbackWarRoomPreflightResult,
  hasWarRoomStyleSignals,
  parseWarRoomPreflightResult,
} from "./war-room-preflight";

const asset: AssetModel = {
  _id: "asset-1",
  prompt: "Stylized mech pilot",
  style: "neo-arcade",
  image: { url: "https://example.com/model.png" },
  createdAt: "2026-03-10T10:00:00.000Z",
  isPublic: true,
};

describe("war-room-preflight", () => {
  it("parses a valid AI response into exactly three questions", () => {
    const result = parseWarRoomPreflightResult(
      JSON.stringify({
        questions: [
          {
            id: "loop",
            label: "Core Loop",
            question: "What happens every 15 seconds of play?",
            placeholder: "Describe the repeated action loop.",
          },
          {
            id: "style",
            label: "Style",
            question: "What should the camera and mood feel like?",
            placeholder: "Reference tone and visual pacing.",
          },
          {
            id: "limits",
            label: "Constraints",
            question: "What must stay in or out of the first playable build?",
            placeholder: "List scope boundaries.",
          },
        ],
      }),
    );

    expect(result.source).toBe("ai");
    expect(result.questions).toHaveLength(3);
    expect(result.questions[0].question).toContain("15 seconds");
  });

  it("falls back cleanly when the AI output is malformed", () => {
    const result = parseWarRoomPreflightResult("not json", {
      assets: [],
      gameFormat: "2d",
      idea: "Build a roguelite with tight runs and no visual style given yet.",
    });

    expect(result).toEqual(
      getFallbackWarRoomPreflightResult({
        assets: [],
        gameFormat: "2d",
        idea: "Build a roguelite with tight runs and no visual style given yet.",
      }),
    );
  });

  it("forces an art-direction question when the brief lacks style signals", () => {
    const result = parseWarRoomPreflightResult(
      JSON.stringify({
        questions: [
          {
            id: "loop",
            label: "Core Loop",
            question: "What should happen every round?",
            placeholder: "Describe the loop.",
          },
          {
            id: "systems",
            label: "Systems",
            question: "Which mechanics must land first?",
            placeholder: "List the core systems.",
          },
          {
            id: "limits",
            label: "Constraints",
            question: "What stays out of v1?",
            placeholder: "List the cuts.",
          },
        ],
      }),
      {
        assets: [],
        gameFormat: "2d",
        idea: "Make a fast arena survival game.",
      },
    );

    expect(result.questions).toHaveLength(3);
    expect(result.questions.some((question) => question.id === "art_direction")).toBe(true);
  });

  it("detects style signals from the brief or references", () => {
    expect(
      hasWarRoomStyleSignals({
        assets: [asset],
        idea: "A neon pilot shooter with pixel art UI",
      }),
    ).toBe(true);
  });

  it("builds runtime-aware intake instructions", () => {
    const instructions = buildWarRoomPreflightInstructions({
      forceArtDirectionQuestion: true,
      gameFormat: "2d",
      genre: "side-scroller-2d-3d",
    });

    expect(instructions).toContain("2D Phaser runtime");
    expect(instructions).toContain("MUST lock art direction");
  });

  it("composes the dispatch prompt with answers and visual references", () => {
    const prompt = composeWarRoomPrompt({
      gameName: "Star Arena",
      gameFormat: "2d",
      genre: "arena-dogfighter",
      idea: "Fast PvE mech arena game",
      assets: [asset],
      answers: [
        {
          id: "loop",
          label: "Core Loop",
          question: "What happens every wave?",
          placeholder: "",
          answer: "Survive escalating enemy waves and cash in combos.",
        },
        {
          id: "style",
          label: "Style",
          question: "How should it feel?",
          placeholder: "",
          answer: "Readable neon cockpit HUD with punchy camera shake.",
        },
        {
          id: "limits",
          label: "Constraints",
          question: "What stays in scope?",
          placeholder: "",
          answer: "Single arena, one boss, and no meta progression in v1.",
        },
      ],
    });

    expect(prompt).toContain("# War Room Brief");
    expect(prompt).toContain("Fast PvE mech arena game");
    expect(prompt).toContain("Format: 2d");
    expect(prompt).toContain("Single arena, one boss");
    expect(prompt).toContain("Stylized mech pilot");
  });
});

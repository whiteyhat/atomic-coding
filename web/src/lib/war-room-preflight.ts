import type { AssetModel } from "./types";

export interface WarRoomPreflightQuestion {
  id: string;
  label: string;
  question: string;
  placeholder: string;
  suggestions: string[];
  recommendedIndex: number;
  recommendedReason: string;
}

export interface WarRoomPreflightResult {
  questions: WarRoomPreflightQuestion[];
  source: "ai" | "fallback";
}

export interface WarRoomPreflightAnswer extends WarRoomPreflightQuestion {
  answer: string;
}

export interface WarRoomPreflightContext {
  assets: AssetModel[];
  gameFormat?: "2d" | "3d" | null;
  gameName: string;
  genre: string | null;
  idea: string;
}

const STYLE_SIGNAL_PATTERN =
  /\b(pixel|pixel art|hand-drawn|hand drawn|anime|manga|cel[- ]shaded|toon|cartoon|comic|illustrated|painterly|watercolor|oil paint|low[- ]poly|voxel|retro|8-bit|16-bit|realistic|photoreal|stylized|gritty|cozy|cute|noir|neon|minimal|minimalist|gothic|fantasy|sci[- ]fi|cyberpunk|steampunk|horror|pastel|monochrome|palette|mood|lighting|look|art style|visual style|camera|isometric|side view|top[- ]down)\b/i;
const ART_DIRECTION_SIGNAL_PATTERN =
  /\b(art|style|visual|palette|mood|lighting|camera|perspective|reference|look)\b/i;

const CORE_LOOP_BY_GENRE: Record<string, { suggestions: string[]; recommendedIndex: number; recommendedReason: string }> = {
  "platformer": {
    suggestions: [
      "Run, jump, wall-slide. Fall into pits to die, reach the flag to clear the level.",
      "Dash and attack enemies mid-air. Lose all HP to fail, defeat the boss to win.",
      "Collect coins while dodging traps. Timer runs out = game over, exit door = clear.",
    ],
    recommendedIndex: 0,
    recommendedReason: "Classic platformer loop — players grasp it instantly.",
  },
  "shooter": {
    suggestions: [
      "Aim, shoot, take cover. Lose HP to die, eliminate all enemies to advance.",
      "Dodge bullets, fire back, grab power-ups. Last hit kills you, clear waves to win.",
      "Strafe and shoot in arenas. Run out of lives to lose, survive all rounds to win.",
    ],
    recommendedIndex: 1,
    recommendedReason: "Bullet-dodge loop keeps the pace high for shooters.",
  },
  "puzzle": {
    suggestions: [
      "Drag and match tiles to clear the board. No moves left = fail, clear target = win.",
      "Rotate pieces to connect paths. Timer expires = lose, connect all nodes = win.",
      "Push blocks onto switches. Get stuck = restart, all switches lit = level clear.",
    ],
    recommendedIndex: 0,
    recommendedReason: "Match-based loops are the most intuitive for puzzle games.",
  },
  "rpg": {
    suggestions: [
      "Explore, talk to NPCs, fight turn-based battles. Party wipe = game over, beat boss = advance.",
      "Loot gear, level up, manage party. Die in combat to lose, complete quests to progress.",
      "Roam open areas, craft items, engage enemies. HP hits zero = respawn, reach story milestones to win.",
    ],
    recommendedIndex: 1,
    recommendedReason: "Loot-and-level loop drives engagement in RPGs.",
  },
};

const DEFAULT_CORE_LOOP = {
  suggestions: [
    "Move, shoot, dodge enemies. Die on hit, win by clearing all waves.",
    "Explore, collect items, solve puzzles. Fail by running out of time.",
    "Jump between platforms, avoid hazards. Fall off-screen to lose, reach the exit to win.",
  ],
  recommendedIndex: 0,
  recommendedReason: "Action loop is the safest default for most game types.",
};

const CONSTRAINTS_BY_FORMAT: Record<string, { suggestions: string[]; recommendedIndex: number; recommendedReason: string }> = {
  "2d": {
    suggestions: [
      "60fps on mobile. Single scene, no level editor. Sprite sheets under 2MB total.",
      "Max 3 enemy types, 1 level. No save system. Keyboard + touch input only.",
      "Score counter and restart button required. No menus, no cutscenes, no audio yet.",
    ],
    recommendedIndex: 2,
    recommendedReason: "Score + restart is the minimum for a playable 2D build.",
  },
  "3d": {
    suggestions: [
      "60fps on mid-range GPU. One small arena. Low-poly under 10k tris per model.",
      "Single camera angle, no free-look. Max 3 interactable object types. No physics ragdoll.",
      "Basic HUD with health bar and restart. Skip inventory, crafting, and dialogue systems.",
    ],
    recommendedIndex: 0,
    recommendedReason: "Performance ceiling matters most for a 3D first build.",
  },
};

const DEFAULT_CONSTRAINTS = {
  suggestions: [
    "Must run at 60fps on mobile. No multiplayer, no save system. Single level only.",
    "Keep it under 3 enemy types. No procedural generation. Touch-friendly controls.",
    "Include a score counter and restart button. Skip cutscenes and menus for now.",
  ],
  recommendedIndex: 2,
  recommendedReason: "Score + restart is the minimum viable playable loop.",
};

const DEFAULT_REFERENCES = {
  suggestions: [
    "Inspired by classic arcade games. Avoid realistic violence. Target casual players.",
    "Take cues from roguelikes like Hades. Avoid pay-to-win mechanics. Target core gamers.",
    "Family-friendly style like Mario. No dark themes. Bright colors, simple controls.",
  ],
  recommendedIndex: 0,
  recommendedReason: "Arcade references keep scope tight and accessible.",
};

function getBaseFallbackQuestions(
  genre: string | null | undefined,
  gameFormat: "2d" | "3d" | null | undefined,
): WarRoomPreflightQuestion[] {
  const genreKey = genre?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  const coreLoop = CORE_LOOP_BY_GENRE[genreKey] ?? DEFAULT_CORE_LOOP;
  const constraints = (gameFormat && CONSTRAINTS_BY_FORMAT[gameFormat]) ?? DEFAULT_CONSTRAINTS;

  return [
    {
      id: "core_loop",
      label: "Core Loop",
      question: "What should players do every 10-20 seconds, and what makes them win or lose?",
      placeholder: "Describe the repeated action loop, the main failure state, and the success condition.",
      ...coreLoop,
    },
    {
      id: "constraints",
      label: "Constraints",
      question: "What must be included or avoided in this first playable version?",
      placeholder: "List non-negotiable mechanics, performance limits, audience expectations, or cut-scope rules.",
      ...constraints,
    },
    {
      id: "references",
      label: "References",
      question: "What references, mechanics, or content rules should the team follow or avoid while building this?",
      placeholder: "Call out inspirations, forbidden mechanics, target audience, and anything the build must not resemble.",
      ...DEFAULT_REFERENCES,
    },
  ];
}

const DEFAULT_QUESTION_IDS = ["core_loop", "constraints", "references"];

function normalizeId(value: string, index: number): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || DEFAULT_QUESTION_IDS[index] || `question_${index + 1}`;
}

const MAX_SUGGESTION_LENGTH = 100;

function capSuggestion(text: string): string {
  if (text.length <= MAX_SUGGESTION_LENGTH) return text;
  // Cut at last word boundary before limit, add ellipsis
  const trimmed = text.slice(0, MAX_SUGGESTION_LENGTH);
  const lastSpace = trimmed.lastIndexOf(" ");
  return (lastSpace > 60 ? trimmed.slice(0, lastSpace) : trimmed) + "...";
}

function parseSuggestions(
  value: unknown,
  fallback: WarRoomPreflightQuestion,
): { suggestions: string[]; recommendedIndex: number; recommendedReason: string } {
  const candidate = value as {
    suggestions?: unknown;
    recommendedIndex?: unknown;
    recommendedReason?: unknown;
  };

  let suggestions = fallback.suggestions;
  if (
    Array.isArray(candidate.suggestions) &&
    candidate.suggestions.length >= 3
  ) {
    const parsed = candidate.suggestions
      .slice(0, 3)
      .map((s) => (typeof s === "string" ? capSuggestion(s.trim()) : ""))
      .filter((s) => s.length > 0);
    if (parsed.length === 3) {
      suggestions = parsed;
    }
  }

  let recommendedIndex = fallback.recommendedIndex;
  if (
    typeof candidate.recommendedIndex === "number" &&
    candidate.recommendedIndex >= 0 &&
    candidate.recommendedIndex <= 2
  ) {
    recommendedIndex = candidate.recommendedIndex;
  }

  let recommendedReason = fallback.recommendedReason;
  if (
    typeof candidate.recommendedReason === "string" &&
    candidate.recommendedReason.trim().length > 0
  ) {
    recommendedReason = capSuggestion(candidate.recommendedReason.trim());
  }

  return { suggestions, recommendedIndex, recommendedReason };
}

function parseQuestion(
  value: unknown,
  index: number,
  fallbackQuestions: WarRoomPreflightQuestion[],
): WarRoomPreflightQuestion | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<WarRoomPreflightQuestion>;
  const fallback =
    fallbackQuestions[index] ??
    fallbackQuestions[fallbackQuestions.length - 1];
  const question = candidate.question?.trim();

  if (!question) return null;

  const { suggestions, recommendedIndex, recommendedReason } = parseSuggestions(value, fallback);

  return {
    id: normalizeId(candidate.id ?? fallback.id, index),
    label: candidate.label?.trim() || fallback.label,
    question,
    placeholder: candidate.placeholder?.trim() || fallback.placeholder,
    suggestions,
    recommendedIndex,
    recommendedReason,
  };
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function summarizeAssets(assets: AssetModel[]): string {
  if (assets.length === 0) {
    return "None";
  }

  return assets
    .slice(0, 5)
    .map((asset, index) => {
      const style = asset.style?.trim() ? ` | style: ${asset.style.trim()}` : "";
      return `${index + 1}. ${asset.prompt.trim()}${style}`;
    })
    .join("\n");
}

function getArtDirectionQuestion(
  gameFormat: "2d" | "3d" | null | undefined,
): WarRoomPreflightQuestion {
  const cameraHint =
    gameFormat === "2d"
      ? "camera feel, framing, and sprite readability"
      : "camera feel, perspective, and scene readability";

  return {
    id: "art_direction",
    label: "Art Direction",
    question:
      "What art style, palette, mood, and reference boundaries should define the build?",
    placeholder: `Describe ${cameraHint}, the palette, visual inspirations, and anything the art must avoid.`,
    suggestions: gameFormat === "3d"
      ? [
          "Low-poly stylized, limited palette, clean silhouettes. Avoid photorealism.",
          "Voxel art, chunky shapes, bright saturated colors. No realistic textures.",
          "Flat-shaded cartoon, bold outlines, warm lighting. Avoid dark/gritty tones.",
        ]
      : [
          "Pixel art, limited palette (16 colors), retro CRT glow. Avoid realism.",
          "Clean vector art, pastel tones, cozy mood. No dark or gritty aesthetics.",
          "Hand-drawn sketch style, warm earthy palette, storybook feel. Avoid neon.",
        ],
    recommendedIndex: 0,
    recommendedReason: gameFormat === "3d"
      ? "Low-poly is fastest to generate and runs well at scale."
      : "Pixel art is fastest to generate and scales cleanly.",
  };
}

export function hasWarRoomStyleSignals({
  assets,
  idea,
}: Pick<WarRoomPreflightContext, "assets" | "idea">): boolean {
  const haystack = [
    idea.trim(),
    ...assets.flatMap((asset) => [asset.prompt, asset.style ?? ""]),
  ]
    .join(" \n")
    .trim();

  return STYLE_SIGNAL_PATTERN.test(haystack);
}

function ensureArtDirectionQuestion(
  questions: WarRoomPreflightQuestion[],
  gameFormat: "2d" | "3d" | null | undefined,
): WarRoomPreflightQuestion[] {
  const artQuestion = getArtDirectionQuestion(gameFormat);
  const next = questions.slice(0, 3);
  const existingIndex = next.findIndex((question) =>
    ART_DIRECTION_SIGNAL_PATTERN.test(`${question.label} ${question.question}`),
  );

  if (existingIndex !== -1) {
    next[existingIndex] = {
      ...next[existingIndex],
      id: "art_direction",
    };
    return next;
  }

  const replacementIndex = next.length >= 3 ? 1 : next.length;
  next[replacementIndex] = artQuestion;
  return next.slice(0, 3);
}

function finalizeQuestionSet(
  questions: WarRoomPreflightQuestion[],
  context?: Pick<WarRoomPreflightContext, "assets" | "gameFormat" | "genre" | "idea">,
): WarRoomPreflightQuestion[] {
  const fallbacks = getBaseFallbackQuestions(context?.genre, context?.gameFormat);
  const normalized = questions.slice(0, 3);

  while (normalized.length < 3) {
    normalized.push(
      fallbacks[normalized.length] ??
        fallbacks[fallbacks.length - 1],
    );
  }

  if (context && !hasWarRoomStyleSignals(context)) {
    return ensureArtDirectionQuestion(normalized, context.gameFormat);
  }

  return normalized;
}

export function getFallbackWarRoomPreflightResult(
  context?: Pick<WarRoomPreflightContext, "assets" | "gameFormat" | "genre" | "idea">,
): WarRoomPreflightResult {
  const fallbacks = getBaseFallbackQuestions(context?.genre, context?.gameFormat);
  const questions = finalizeQuestionSet(fallbacks, context);

  return {
    questions,
    source: "fallback",
  };
}

export function parseWarRoomPreflightResult(
  text: string,
  context?: Pick<WarRoomPreflightContext, "assets" | "gameFormat" | "genre" | "idea">,
): WarRoomPreflightResult {
  const parsed = extractJson(text);
  const rawQuestions = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as { questions?: unknown }).questions
      : null;

  if (!Array.isArray(rawQuestions)) {
    return getFallbackWarRoomPreflightResult(context);
  }

  const fallbacks = getBaseFallbackQuestions(context?.genre, context?.gameFormat);
  const normalized = rawQuestions
    .slice(0, 3)
    .map((item, index) => parseQuestion(item, index, fallbacks))
    .filter((item): item is WarRoomPreflightQuestion => item !== null);

  if (normalized.length !== 3) {
    return getFallbackWarRoomPreflightResult(context);
  }

  const finalized = finalizeQuestionSet(normalized, context);
  const dedupedIds = new Set<string>();
  const questions = finalized.map((question, index) => {
    const nextId = dedupedIds.has(question.id)
      ? `${question.id}_${index + 1}`
      : question.id;
    dedupedIds.add(nextId);

    return {
      ...question,
      id: nextId,
    };
  });

  return {
    questions,
    source: "ai",
  };
}

export function buildWarRoomPreflightInstructions({
  forceArtDirectionQuestion,
  gameFormat,
  genre,
}: {
  forceArtDirectionQuestion: boolean;
  gameFormat?: "2d" | "3d" | null;
  genre: string | null;
}): string {
  return [
    "You are preparing a war-room intake for a game maker pipeline.",
    "Return strict JSON only.",
    'Use this exact shape: {"questions":[{"id":"string","label":"string","question":"string","placeholder":"string","suggestions":["string","string","string"],"recommendedIndex":0,"recommendedReason":"string"}]}',
    "Return exactly 3 adaptive questions.",
    "Each question MUST include exactly 3 suggested answers in the 'suggestions' array.",
    "CRITICAL: Every suggestion MUST directly reference the user's game idea — use their game's nouns, verbs, enemies, mechanics, or theme. Never output generic boilerplate like 'move, shoot, dodge' unless the user literally described that.",
    "Each suggestion must be a concise, actionable scope decision (max 100 characters). Write them as direct answers, not vague directions.",
    "Set 'recommendedIndex' (0, 1, or 2) to indicate which suggestion best fits the stated game idea.",
    "Set 'recommendedReason' to a short explanation (max 80 characters) of WHY you recommend that option — reference a specific constraint, genre convention, or detail from the user's idea.",
    "The questions must materially improve scope clarity for gameplay, presentation, and implementation constraints.",
    "Keep each label under 20 characters.",
    "Keep each question under 160 characters.",
    "Do not ask generic filler like budget, timeline, or 'tell me more'.",
    forceArtDirectionQuestion
      ? "At least one question MUST lock art direction: art style, palette, mood, and reference constraints."
      : "Only ask an art-direction question if the brief still needs visual clarification.",
    gameFormat === "2d"
      ? "This game targets a 2D Phaser runtime. Prefer questions about camera feel, sprite readability, and screen-space presentation."
      : gameFormat === "3d"
        ? "This game targets a 3D Three.js runtime. Prefer questions about camera perspective, scene readability, and spatial scale."
        : "No runtime target is fixed yet.",
    genre ? `Bias the questions toward the ${genre} genre.` : "No fixed genre is available.",
  ].join("\n");
}

export function buildWarRoomPreflightMessage({
  assets,
  gameFormat,
  gameName,
  genre,
  idea,
}: WarRoomPreflightContext): string {
  const hasStyleSignals = hasWarRoomStyleSignals({ assets, idea });

  return [
    `Game: ${gameName}`,
    `Genre: ${genre ?? "custom"}`,
    `Format: ${gameFormat ?? "unspecified"}`,
    `Style signals already present: ${hasStyleSignals ? "yes" : "no"}`,
    "",
    "Initial idea:",
    idea.trim(),
    "",
    "Attached visual references:",
    summarizeAssets(assets),
    "",
    "Generate the 3 most useful intake questions for the war room.",
  ].join("\n");
}

export function composeWarRoomPrompt({
  answers,
  assets,
  gameFormat,
  gameName,
  genre,
  idea,
}: {
  answers: WarRoomPreflightAnswer[];
  assets: AssetModel[];
  gameFormat?: "2d" | "3d" | null;
  gameName: string;
  genre: string | null;
  idea: string;
}): string {
  const qaSection = answers
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.question}\nAnswer: ${entry.answer.trim() || "Not provided"}`,
    )
    .join("\n\n");

  return [
    "# War Room Brief",
    `Game: ${gameName}`,
    `Genre: ${genre ?? "custom"}`,
    `Format: ${gameFormat ?? "unspecified"}`,
    "",
    "## Primary Objective",
    idea.trim(),
    "",
    "## Strategy Intake",
    qaSection,
    "",
    "## Visual References",
    summarizeAssets(assets),
    "",
    "Use this intake as the source of truth for scope, mechanics, art direction, v1 constraints, and runtime expectations.",
  ].join("\n");
}

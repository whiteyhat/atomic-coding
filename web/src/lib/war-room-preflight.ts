import type { AssetModel } from "./types";

export interface WarRoomPreflightQuestion {
  id: string;
  label: string;
  question: string;
  placeholder: string;
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

const BASE_FALLBACK_QUESTIONS: WarRoomPreflightQuestion[] = [
  {
    id: "core_loop",
    label: "Core Loop",
    question:
      "What should players do every 10-20 seconds, and what makes them win or lose?",
    placeholder:
      "Describe the repeated action loop, the main failure state, and the success condition.",
  },
  {
    id: "constraints",
    label: "Constraints",
    question:
      "What must be included or avoided in this first playable version?",
    placeholder:
      "List non-negotiable mechanics, performance limits, audience expectations, or cut-scope rules.",
  },
  {
    id: "references",
    label: "References",
    question:
      "What references, mechanics, or content rules should the team follow or avoid while building this?",
    placeholder:
      "Call out inspirations, forbidden mechanics, target audience, and anything the build must not resemble.",
  },
];

function normalizeId(value: string, index: number): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || BASE_FALLBACK_QUESTIONS[index]?.id || `question_${index + 1}`;
}

function parseQuestion(
  value: unknown,
  index: number,
): WarRoomPreflightQuestion | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<WarRoomPreflightQuestion>;
  const fallback =
    BASE_FALLBACK_QUESTIONS[index] ??
    BASE_FALLBACK_QUESTIONS[BASE_FALLBACK_QUESTIONS.length - 1];
  const question = candidate.question?.trim();

  if (!question) return null;

  return {
    id: normalizeId(candidate.id ?? fallback.id, index),
    label: candidate.label?.trim() || fallback.label,
    question,
    placeholder: candidate.placeholder?.trim() || fallback.placeholder,
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
  context?: Pick<WarRoomPreflightContext, "assets" | "gameFormat" | "idea">,
): WarRoomPreflightQuestion[] {
  const normalized = questions.slice(0, 3);

  while (normalized.length < 3) {
    normalized.push(
      BASE_FALLBACK_QUESTIONS[normalized.length] ??
        BASE_FALLBACK_QUESTIONS[BASE_FALLBACK_QUESTIONS.length - 1],
    );
  }

  if (context && !hasWarRoomStyleSignals(context)) {
    return ensureArtDirectionQuestion(normalized, context.gameFormat);
  }

  return normalized;
}

export function getFallbackWarRoomPreflightResult(
  context?: Pick<WarRoomPreflightContext, "assets" | "gameFormat" | "idea">,
): WarRoomPreflightResult {
  const questions = finalizeQuestionSet(
    BASE_FALLBACK_QUESTIONS,
    context,
  );

  return {
    questions,
    source: "fallback",
  };
}

export function parseWarRoomPreflightResult(
  text: string,
  context?: Pick<WarRoomPreflightContext, "assets" | "gameFormat" | "idea">,
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

  const normalized = rawQuestions
    .slice(0, 3)
    .map((item, index) => parseQuestion(item, index))
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
    'Use this exact shape: {"questions":[{"id":"string","label":"string","question":"string","placeholder":"string"}]}',
    "Return exactly 3 adaptive questions.",
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

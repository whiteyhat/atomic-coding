"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Box,
  Check,
  Loader2,
  PenLine,
  Sparkles,
  Swords,
  WandSparkles,
} from "lucide-react";
import { useSWRConfig } from "swr";
import { AssetModelDialog } from "@/components/chat/asset-model-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { createWarRoom, preflightWarRoom } from "@/lib/api";
import {
  composeWarRoomPrompt,
  getFallbackWarRoomPreflightResult,
  type WarRoomPreflightAnswer,
  type WarRoomPreflightQuestion,
} from "@/lib/war-room-preflight";
import { getWarRoomsKey } from "@/lib/hooks/use-war-rooms";
import type { AssetModel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WarRoomPanel } from "./war-room-panel";

type DraftStage = "idea" | "questions" | "review";

interface WarRoomChatPanelProps {
  gameName: string;
  gameFormat: "2d" | "3d" | null;
  genre: string | null;
  onSuggestedPrompt: (prompt: string) => void;
  onWarRoomCreated: (warRoomId: string) => void;
  warRoomId?: string | null;
}

const STEPS: Array<{ id: DraftStage; label: string }> = [
  { id: "idea", label: "Intent" },
  { id: "questions", label: "Scope" },
  { id: "review", label: "Dispatch" },
];

export function WarRoomChatPanel({
  gameName,
  gameFormat,
  genre,
  onSuggestedPrompt,
  onWarRoomCreated,
  warRoomId,
}: WarRoomChatPanelProps) {
  if (warRoomId) {
    return (
      <WarRoomPanel
        gameName={gameName}
        warRoomId={warRoomId}
        onSuggestedPrompt={onSuggestedPrompt}
      />
    );
  }

  return (
    <WarRoomDraftPanel
      gameName={gameName}
      gameFormat={gameFormat}
      genre={genre}
      onWarRoomCreated={onWarRoomCreated}
    />
  );
}

function WarRoomDraftPanel({
  gameName,
  gameFormat,
  genre,
  onWarRoomCreated,
}: {
  gameName: string;
  gameFormat: "2d" | "3d" | null;
  genre: string | null;
  onWarRoomCreated: (warRoomId: string) => void;
}) {
  const { mutate } = useSWRConfig();
  const [stage, setStage] = useState<DraftStage>("idea");
  const [idea, setIdea] = useState("");
  const [questions, setQuestions] = useState<WarRoomPreflightQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedAssets, setSelectedAssets] = useState<AssetModel[]>([]);
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [preflightSource, setPreflightSource] = useState<"ai" | "fallback">("ai");
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [customModeQuestions, setCustomModeQuestions] = useState<Set<string>>(new Set());

  const answerEntries = useMemo<WarRoomPreflightAnswer[]>(
    () =>
      questions.map((question) => ({
        ...question,
        answer: answers[question.id]?.trim() ?? "",
      })),
    [answers, questions],
  );
  const canAdvanceToReview = answerEntries.length === 3 && answerEntries.every((entry) => entry.answer.length > 0);

  async function handleGenerateQuestions() {
    if (!idea.trim()) return;

    setError(null);

    // Show fallback questions immediately so the user can start answering
    const fallback = getFallbackWarRoomPreflightResult({
      assets: selectedAssets,
      gameFormat,
      genre,
      idea: idea.trim(),
    });
    setQuestions(fallback.questions);
    setPreflightSource(fallback.source);
    setAnswers((current) =>
      fallback.questions.reduce<Record<string, string>>((next, question) => {
        next[question.id] = current[question.id] ?? "";
        return next;
      }, {}),
    );
    setStage("questions");

    // Upgrade to AI-generated questions in background
    setIsGeneratingQuestions(true);
    try {
      const result = await preflightWarRoom({
        gameName,
        gameFormat,
        genre,
        idea: idea.trim(),
        assets: selectedAssets,
      });
      // Only upgrade if still on questions stage (user hasn't moved on)
      setStage((currentStage) => {
        if (currentStage !== "questions") return currentStage;
        setQuestions(result.questions);
        setPreflightSource(result.source);
        setAnswers((current) => {
          // Preserve any answers the user already typed
          return result.questions.reduce<Record<string, string>>((next, question, index) => {
            const fallbackId = fallback.questions[index]?.id;
            next[question.id] = current[question.id] ?? (fallbackId ? current[fallbackId] : "") ?? "";
            return next;
          }, {});
        });
        return currentStage;
      });
    } catch {
      // Already showing fallback questions, no action needed
    } finally {
      setIsGeneratingQuestions(false);
    }
  }

  async function handleDispatch() {
    if (!canAdvanceToReview) return;

    setError(null);
    setIsDispatching(true);
    try {
      const warRoom = await createWarRoom(
        gameName,
        composeWarRoomPrompt({
          gameName,
          gameFormat,
          genre,
          idea: idea.trim(),
          answers: answerEntries,
          assets: selectedAssets,
        }),
        undefined,
        genre ?? undefined,
        gameFormat,
        selectedAssets.map((asset) => ({
          id: asset._id,
          prompt: asset.prompt,
          style: asset.style,
          image_url: asset.image.url,
          created_at: asset.createdAt,
          is_public: asset.isPublic,
        })),
      );
      // Fire cache invalidation in background — don't block navigation on it
      void mutate(getWarRoomsKey(gameName));
      onWarRoomCreated(warRoom.id);
    } catch (dispatchError) {
      setError(
        dispatchError instanceof Error
          ? dispatchError.message
          : "Failed to create war room",
      );
    } finally {
      setIsDispatching(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,#43131d_0%,#1a0a0f_48%,#0d0406_100%)]">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-[1.1rem] border border-rose-300/20 bg-rose-500/10 text-rose-50">
                <Swords className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">War Room Intake</p>
                <p className="text-[11px] text-white/45">
                  Adaptive planning before dispatching the multi-agent pipeline
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {STEPS.map((stepItem, index) => {
                const isActive = stage === stepItem.id;
                const isComplete = STEPS.findIndex((entry) => entry.id === stage) > index;

                return (
                  <div
                    key={stepItem.id}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em]",
                      isActive
                        ? "border-rose-300/30 bg-rose-500/10 text-rose-50"
                        : isComplete
                          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                          : "border-white/10 bg-white/[0.03] text-white/35",
                    )}
                  >
                    <span>{`0${index + 1}`}</span>
                    <span>{stepItem.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "size-9 rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]",
                  selectedAssets.length > 0 && "border-blue-300/20 bg-blue-500/10 text-blue-200",
                )}
                onClick={() => setAssetDialogOpen(true)}
              >
                <Box className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {selectedAssets.length > 0
                ? `${selectedAssets.length} visual reference${selectedAssets.length > 1 ? "s" : ""} attached`
                : "Attach visual references"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 px-5 py-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(155deg,rgba(251,113,133,0.14),rgba(255,255,255,0.03))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.28)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.2em] text-rose-100/55">
                  Operator lane
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  Shape the run before Jarvis dispatches the pipeline
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
                  Capture the game direction once, answer three targeted scope questions, and turn it into a cleaner war-room brief for Forge, Pixel, and Checker.
                </p>
              </div>
              <div className="hidden rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 text-right md:block">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
                  Attached refs
                </p>
                <p className="mt-1 text-2xl font-semibold text-white">{selectedAssets.length}</p>
              </div>
            </div>

            {selectedAssets.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedAssets.slice(0, 5).map((asset) => (
                  <Badge
                    key={asset._id}
                    variant="outline"
                    className="rounded-full border-white/12 bg-black/20 px-3 py-1 text-[11px] text-white/68"
                  >
                    {asset.prompt}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>

          {stage === "idea" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5"
            >
              <div className="mb-4 flex items-center gap-2 text-white">
                <WandSparkles className="size-4 text-rose-200" />
                <p className="text-sm font-semibold">Step 1: describe the push</p>
              </div>
              <p className="mb-3 text-sm leading-6 text-white/58">
                Start with the core idea. Jarvis will turn it into three sharper intake questions for gameplay, presentation, and production constraints.
              </p>
              <Textarea
                value={idea}
                onChange={(event) => setIdea(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !isGeneratingQuestions && idea.trim()) {
                    event.preventDefault();
                    void handleGenerateQuestions();
                  }
                }}
                placeholder="Example: Build a top-down arena shooter with one-minute rounds, heavy neon UI, and readable enemy attack tells for mobile-sized screens."
                className="min-h-40 rounded-[1.35rem] border-white/10 bg-[#12070a]/80 px-4 py-4 text-sm leading-6 text-white placeholder:text-white/28"
              />
            </motion.div>
          )}

          {stage === "questions" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Bot className="size-4 text-rose-200" />
                  <div>
                    <p className="text-sm font-semibold text-white">Step 2: scope questions</p>
                    <p className="text-[11px] text-white/42">
                      {isGeneratingQuestions
                        ? "Jarvis is refining questions..."
                        : preflightSource === "ai"
                          ? "Adaptive Jarvis preflight"
                          : "Fallback intake prompts"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full border-white/12 bg-white/[0.05] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60"
                >
                  3 prompts
                </Badge>
              </div>

              {questions.map((question, index) => {
                const currentAnswer = answers[question.id] ?? "";
                const selectedSuggestionIndex = question.suggestions.findIndex(
                  (s) => s === currentAnswer
                );
                const isCustomMode =
                  (customModeQuestions.has(question.id) || (currentAnswer.length > 0 && selectedSuggestionIndex === -1));

                return (
                  <div
                    key={question.id}
                    className="rounded-[1.65rem] border border-white/10 bg-[linear-gradient(155deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                          {`0${index + 1}`} {question.label}
                        </p>
                        <p className="mt-2 text-base font-medium text-white">
                          {question.question}
                        </p>
                      </div>
                      <Sparkles className="mt-1 size-4 text-rose-200/70" />
                    </div>

                    <div className="mt-4 space-y-2">
                      {question.suggestions.map((suggestion, sIndex) => {
                        const isRecommended =
                          sIndex === question.recommendedIndex;
                        const isSelected = selectedSuggestionIndex === sIndex;

                        return (
                          <motion.button
                            key={sIndex}
                            type="button"
                            onClick={() => {
                              setCustomModeQuestions((prev) => {
                                const next = new Set(prev);
                                next.delete(question.id);
                                return next;
                              });
                              setAnswers((current) => ({
                                ...current,
                                [question.id]: isSelected ? "" : suggestion,
                              }));
                            }}
                            className={cn(
                              "group relative w-full rounded-[1.15rem] border px-4 py-3 text-left text-sm leading-6 transition-all",
                              isSelected
                                ? "border-rose-400/35 bg-rose-500/15 text-white"
                                : "border-white/10 bg-[#11070a]/60 text-white/72 hover:border-white/18 hover:bg-white/[0.06]"
                            )}
                            whileHover={{ scale: 1.005 }}
                            whileTap={{ scale: 0.995 }}
                            {...(isRecommended && !isSelected
                              ? {
                                  animate: {
                                    borderColor: [
                                      "rgba(251,113,133,0.12)",
                                      "rgba(251,113,133,0.35)",
                                      "rgba(251,113,133,0.12)",
                                    ],
                                  },
                                  transition: {
                                    duration: 2.4,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                  },
                                }
                              : {})}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
                                  isSelected
                                    ? "border-rose-400 bg-rose-500"
                                    : "border-white/20 bg-white/[0.04]"
                                )}
                              >
                                {isSelected && (
                                  <Check className="size-3 text-white" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                {isRecommended && (
                                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <span className="inline-block rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300">
                                      Recommended
                                    </span>
                                    {question.recommendedReason && (
                                      <span className="text-[11px] italic text-white/40">
                                        {question.recommendedReason}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <p>{suggestion}</p>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}

                      {/* Custom answer option */}
                      <motion.button
                        type="button"
                        onClick={() => {
                          if (!isCustomMode) {
                            setCustomModeQuestions((prev) => new Set(prev).add(question.id));
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: "",
                            }));
                          }
                        }}
                        className={cn(
                          "group relative w-full rounded-[1.15rem] border px-4 py-3 text-left text-sm transition-all",
                          isCustomMode
                            ? "border-rose-400/35 bg-rose-500/15 text-white"
                            : "border-white/10 bg-[#11070a]/60 text-white/72 hover:border-white/18 hover:bg-white/[0.06]"
                        )}
                        whileHover={{ scale: 1.005 }}
                        whileTap={{ scale: 0.995 }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
                              isCustomMode
                                ? "border-rose-400 bg-rose-500"
                                : "border-white/20 bg-white/[0.04]"
                            )}
                          >
                            {isCustomMode ? (
                              <Check className="size-3 text-white" />
                            ) : (
                              <PenLine className="size-2.5 text-white/40" />
                            )}
                          </div>
                          <span className="text-white/55">
                            Describe your own answer
                          </span>
                        </div>
                      </motion.button>

                      <AnimatePresence>
                        {isCustomMode && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Textarea
                              autoFocus
                              value={currentAnswer}
                              onChange={(event) => {
                                const val = event.currentTarget.value;
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: val,
                                }));
                              }}
                              placeholder={question.placeholder}
                              className="min-h-24 rounded-[1.15rem] border-white/10 bg-[#11070a]/75 px-4 py-3 text-sm leading-6 text-white placeholder:text-white/28"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {stage === "review" && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="rounded-[1.75rem] border border-rose-300/15 bg-[linear-gradient(155deg,rgba(251,113,133,0.12),rgba(255,255,255,0.03))] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-rose-100/55">
                      Step 3
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">Dispatch review</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-rose-300/25 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-50"
                  >
                    Ready to launch
                  </Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  This brief is what the war-room pipeline will receive. Review the intent, scope answers, and art references before dispatch.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                  Objective
                </p>
                <p className="mt-3 text-sm leading-7 text-white/82">{idea}</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {answerEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="rounded-[1.5rem] border border-white/10 bg-[#11070a]/70 p-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                      {`0${index + 1}`} {entry.label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-white">{entry.question}</p>
                    <p className="mt-3 text-sm leading-6 text-white/62">{entry.answer}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/35">
                  Visual references
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedAssets.length > 0 ? (
                    selectedAssets.map((asset) => (
                      <Badge
                        key={asset._id}
                        variant="outline"
                        className="rounded-full border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] text-white/68"
                      >
                        {asset.prompt}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-white/45">No visual references attached.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="rounded-[1.4rem] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-white/8 bg-[#12070a]/85 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white"
            disabled={stage === "idea" || isGeneratingQuestions || isDispatching}
            onClick={() =>
              setStage((current) =>
                current === "review" ? "questions" : current === "questions" ? "idea" : current,
              )
            }
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {stage === "idea" ? (
            <Button
              type="button"
              className="rounded-xl bg-white text-black hover:bg-white/90"
              disabled={!idea.trim() || isGeneratingQuestions}
              onClick={handleGenerateQuestions}
            >
              {isGeneratingQuestions ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating questions
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          ) : stage === "questions" ? (
            <Button
              type="button"
              className="rounded-xl bg-white text-black hover:bg-white/90"
              disabled={!canAdvanceToReview}
              onClick={() => setStage("review")}
            >
              Review brief
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="rounded-xl bg-[linear-gradient(135deg,rgba(251,113,133,0.92),rgba(244,63,94,0.84))] text-rose-50 hover:opacity-95"
              disabled={isDispatching}
              onClick={handleDispatch}
            >
              {isDispatching ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Dispatching war room
                </>
              ) : (
                <>
                  <Swords className="size-4" />
                  Launch War Room
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <AssetModelDialog
        open={assetDialogOpen}
        onOpenChange={setAssetDialogOpen}
        selected={selectedAssets}
        onToggle={(model) =>
          setSelectedAssets((current) =>
            current.some((entry) => entry._id === model._id)
              ? current.filter((entry) => entry._id !== model._id)
              : [...current, model],
          )
        }
      />
    </div>
  );
}

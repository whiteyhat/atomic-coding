"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Box,
  Loader2,
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
    setIsGeneratingQuestions(true);
    try {
      const result = await preflightWarRoom({
        gameName,
        gameFormat,
        genre,
        idea: idea.trim(),
        assets: selectedAssets,
      });
      setQuestions(result.questions);
      setPreflightSource(result.source);
      setAnswers((current) =>
        result.questions.reduce<Record<string, string>>((next, question) => {
          next[question.id] = current[question.id] ?? "";
          return next;
        }, {}),
      );
      setStage("questions");
    } catch (requestError) {
      const fallback = getFallbackWarRoomPreflightResult({
        assets: selectedAssets,
        gameFormat,
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
      setError(
        requestError instanceof Error
          ? `${requestError.message} Falling back to standard intake questions.`
          : "Falling back to standard intake questions.",
      );
      setStage("questions");
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
      );
      await mutate(getWarRoomsKey(gameName));
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
                      {preflightSource === "ai" ? "Adaptive Jarvis preflight" : "Fallback intake prompts"}
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

              {questions.map((question, index) => (
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
                  <Textarea
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: event.currentTarget.value,
                      }))
                    }
                    placeholder={question.placeholder}
                    className="mt-4 min-h-28 rounded-[1.25rem] border-white/10 bg-[#11070a]/75 px-4 py-3 text-sm leading-6 text-white placeholder:text-white/28"
                  />
                </div>
              ))}
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

"use client";

import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Loader2,
  Sparkles,
  Square,
  Wand2,
  X,
} from "lucide-react";
import type { Game } from "@/lib/types";
import { createGame } from "@/lib/api";
import {
  type GameFormat,
  getDefaultGameFormatForGenre,
  getGameGenre,
  isGenreSupportedInFormat,
} from "@/lib/game-genres";
import { useAppAuth } from "@/lib/auth-provider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GenreSelector } from "./genre-selector";

const STEP_LABELS = ["Name", "Format", "Genre", "Review"] as const;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const GAME_FORMAT_OPTIONS = [
  {
    value: "2d" as const,
    label: "2D Game",
    description: "Sprite-led movement, side views, top-down spaces, and tighter arcade framing.",
    icon: Square,
    badgeClass: "border-cyan-300/30 bg-cyan-400/15 text-cyan-50",
    iconClass: "text-cyan-100",
    gradientClass: "from-cyan-400/30 via-sky-300/15 to-transparent",
  },
  {
    value: "3d" as const,
    label: "3D Game",
    description: "Full-scene depth, spatial cameras, and worlds built around movement through space.",
    icon: Box,
    badgeClass: "border-fuchsia-300/30 bg-fuchsia-400/15 text-fuchsia-50",
    iconClass: "text-fuchsia-100",
    gradientClass: "from-fuchsia-400/30 via-violet-300/15 to-transparent",
  },
] as const;

const STEP_LABEL_KEYS = ["stepName", "stepFormat", "stepGenre", "stepReview"] as const;
const STEP_DESCRIPTION_KEYS = ["identityFirst", "pickDimension", "chooseScaffold", "finalPass"] as const;

function isDuplicateNameError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already exists") ||
    normalized.includes("duplicate key") ||
    normalized.includes("games_name_key")
  );
}

interface CreateGameWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGenre?: string | null;
  onCreated?: (game: Game) => void;
}

export function CreateGameWizard({
  open,
  onOpenChange,
  initialGenre = null,
  onCreated,
}: CreateGameWizardProps) {
  const router = useRouter();
  const t = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const { ready, authenticated } = useAppAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gameFormat, setGameFormat] = useState<GameFormat | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const wasOpenRef = useRef(false);
  const previousNextDisabledRef = useRef(true);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldPulseNext, setShouldPulseNext] = useState(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const safeInitialGenre = getGameGenre(initialGenre)?.slug ?? null;
      const safeInitialFormat = getDefaultGameFormatForGenre(safeInitialGenre);
      setStep(safeInitialGenre && safeInitialFormat ? 2 : 0);
      setName("");
      setDescription("");
      setGameFormat(safeInitialFormat);
      setGenre(safeInitialGenre);
      setNameError(null);
      setSubmitError(null);
      setLoading(false);
    }

    wasOpenRef.current = open;
  }, [open, initialGenre]);

  useEffect(() => {
    if (!gameFormat || !genre || isGenreSupportedInFormat(genre, gameFormat)) {
      return;
    }

    setGenre(null);
  }, [gameFormat, genre]);

  const selectedGenre = useMemo(() => getGameGenre(genre), [genre]);
  const selectedGameFormat = useMemo(
    () => GAME_FORMAT_OPTIONS.find((option) => option.value === gameFormat) ?? null,
    [gameFormat],
  );
  const previewName = name.trim() || "my-awesome-game";
  const previewDescription = description.trim() || t("reviewFallbackCopy");
  const isNameValid = name.trim().length > 0 && name.trim().length <= MAX_NAME_LENGTH;
  const canReview = isNameValid && !!selectedGameFormat && !!selectedGenre;
  const isPrevDisabled = step === 0 || loading;
  const isNextDisabled =
    loading ||
    step === 3 ||
    (step === 0 && !isNameValid) ||
    (step === 1 && !selectedGameFormat) ||
    (step === 2 && !selectedGenre);
  const keyboardHint =
    step === 0
      ? t("hintStep0")
      : step === 1
        ? t("hintStep1")
        : step === 2
          ? t("hintStep2")
          : t("hintStep3");

  useEffect(() => {
    if (!open) {
      setShouldPulseNext(false);
      previousNextDisabledRef.current = true;
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = null;
      }
      return;
    }

    const shouldTriggerPulse =
      (step === 0 || step === 1 || step === 2) &&
      previousNextDisabledRef.current &&
      !isNextDisabled;

    if (shouldTriggerPulse) {
      triggerNextPulse();
    }

    if (step === 3 || isNextDisabled) {
      setShouldPulseNext(false);
    }

    previousNextDisabledRef.current = isNextDisabled;
  }, [isNextDisabled, open, step]);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  function triggerNextPulse() {
    setShouldPulseNext(true);
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
    }
    pulseTimeoutRef.current = setTimeout(() => {
      setShouldPulseNext(false);
      pulseTimeoutRef.current = null;
    }, 2200);
  }

  function handleNameChange(value: string) {
    setName(value);
    if (nameError) setNameError(null);
    if (submitError) setSubmitError(null);
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    if (submitError) setSubmitError(null);
  }

  function handleGameFormatChange(value: GameFormat) {
    const shouldPulseOnSelection =
      open && step === 1 && !loading && value !== gameFormat;

    if (shouldPulseOnSelection) {
      // Prevent the generic effect from immediately retriggering the same pulse.
      previousNextDisabledRef.current = false;
    }

    setGameFormat(value);
    if (submitError) setSubmitError(null);

    if (shouldPulseOnSelection) {
      triggerNextPulse();
    }
  }

  function validateName(nextMessage?: string): boolean {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setNameError(nextMessage ?? t("errorNameRequired"));
      return false;
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      setNameError(t("errorNameTooLong", { length: MAX_NAME_LENGTH }));
      return false;
    }

    setNameError(null);
    return true;
  }

  function goToFormatStep() {
    if (!validateName()) {
      setStep(0);
      return;
    }

    setStep(1);
  }

  function goToGenreStep() {
    if (!validateName(t("errorNameBeforeGenre"))) {
      setStep(0);
      return;
    }

    if (!selectedGameFormat) {
      setStep(1);
      return;
    }

    setStep(2);
  }

  function goToReviewStep() {
    if (!selectedGameFormat) {
      setStep(1);
      return;
    }

    if (!selectedGenre) {
      setStep(2);
      return;
    }

    if (!validateName(t("errorNameBeforeReview"))) {
      setStep(0);
      return;
    }

    setStep(3);
  }

  function handlePreviousStep() {
    if (isPrevDisabled) return;
    setStep((currentStep) => currentStep - 1);
  }

  function handleNextStep() {
    if (isNextDisabled) return;

    if (step === 0) {
      goToFormatStep();
      return;
    }

    if (step === 1) {
      goToGenreStep();
      return;
    }

    if (step === 2) {
      goToReviewStep();
    }
  }

  function handleStepSelection(nextStep: number) {
    if (loading) return;

    if (nextStep <= step) {
      setStep(nextStep);
      return;
    }

    if (nextStep === 1) {
      goToFormatStep();
      return;
    }

    if (nextStep === 2) {
      goToGenreStep();
      return;
    }

    if (nextStep === 3) {
      goToReviewStep();
    }
  }

  function handleStepHotkey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || loading) {
      return;
    }

    const target = event.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    const isTextarea = tagName === "textarea";
    const isModifierEnter = event.metaKey || event.ctrlKey;

    if (isTextarea && !isModifierEnter) {
      return;
    }

    if (tagName === "button") {
      return;
    }

    event.preventDefault();

    if (step === 0) {
      goToFormatStep();
      return;
    }

    if (step === 1) {
      goToGenreStep();
      return;
    }

    if (step === 2) {
      goToReviewStep();
      return;
    }

    if (step === 3) {
      void handleCreate();
    }
  }

  async function handleCreate() {
    if (!selectedGameFormat) {
      setStep(1);
      return;
    }

    if (!selectedGenre) {
      setStep(2);
      return;
    }

    if (!validateName(t("errorNameBeforeCreate"))) {
      setStep(0);
      return;
    }

    if (!authenticated) {
      setSubmitError(ready ? t("errorSignIn") : t("errorCheckingSession"));
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const game = await createGame(
        name.trim(),
        description.trim() || undefined,
        selectedGenre.slug,
        selectedGameFormat.value,
      );

      onCreated?.(game);
      onOpenChange(false);
      router.push(`/games/${encodeURIComponent(game.name)}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("errorCreateFailed");

      if (isDuplicateNameError(message)) {
        setNameError(t("errorDuplicateName"));
        setStep(0);
      } else {
        setSubmitError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  const formatLabelMap: Record<string, string> = {
    "2d": t("game2d"),
    "3d": t("game3d"),
  };
  const formatDescriptionMap: Record<string, string> = {
    "2d": t("game2dDescription"),
    "3d": t("game3dDescription"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={handleStepHotkey}
        className="max-h-[calc(100vh-1rem)] gap-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[#12070a]/95 p-0 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] sm:h-[calc(100vh-1rem)] sm:max-h-[900px] sm:max-w-[min(1180px,calc(100vw-2rem))]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(251,146,60,0.16),transparent_30%),linear-gradient(180deg,#18080c_0%,#0f0508_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.04)_0%,transparent_18%,transparent_82%,rgba(255,255,255,0.04)_100%)] opacity-40" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-7">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-rose-300/70">
                <Sparkles className="size-3" />
                {t("createFlow")}
              </div>
              <DialogTitle className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                {t("launchTitle")}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6 text-white/60">
                {t("launchDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-1 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <X className="size-4" />
                <span className="sr-only">{tCommon("close")}</span>
              </button>

              <div className="flex flex-row gap-2">
                <button
                  type="button"
                  onClick={handlePreviousStep}
                  disabled={isPrevDisabled}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border transition",
                    isPrevDisabled
                      ? "cursor-not-allowed border-white/8 bg-white/[0.03] text-white/20"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <ArrowLeft className="size-4" />
                  <span className="sr-only">{t("previousStep")}</span>
                </button>

                <motion.button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isNextDisabled}
                  animate={
                    shouldPulseNext
                      ? {
                          scale: [1, 1.08, 1],
                          boxShadow: [
                            "0 0 0 rgba(244,63,94,0)",
                            "0 0 0 10px rgba(244,63,94,0.12)",
                            "0 0 0 rgba(244,63,94,0)",
                          ],
                        }
                      : {
                          scale: 1,
                          boxShadow: "0 0 0 rgba(244,63,94,0)",
                        }
                  }
                  transition={
                    shouldPulseNext
                      ? {
                          duration: 0.9,
                          repeat: 2,
                          ease: "easeInOut",
                        }
                      : { duration: 0.15 }
                  }
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border transition",
                    isNextDisabled
                      ? "cursor-not-allowed border-white/8 bg-white/[0.03] text-white/20"
                      : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white",
                    shouldPulseNext && !isNextDisabled && "border-rose-300/35 bg-rose-400/10 text-rose-100",
                  )}
                >
                  <ArrowRight className="size-4" />
                  <span className="sr-only">{t("nextStep")}</span>
                </motion.button>
              </div>
            </div>
          </div>

          <div className="border-b border-white/8 px-5 py-4 sm:px-7">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {STEP_LABELS.map((label, index) => {
                const isCurrent = index === step;
                const isComplete = index < step;
                const isClickable = index <= step || index === step + 1;

                return (
                  <button
                    key={label}
                    type="button"
                    disabled={!isClickable || loading}
                    onClick={() => handleStepSelection(index)}
                    className={cn(
                      "group rounded-[1.4rem] border px-4 py-3 text-left transition-all",
                      isCurrent
                        ? "border-rose-300/30 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.12)]"
                        : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]",
                      !isClickable && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full border text-sm font-semibold",
                          isComplete
                            ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                            : isCurrent
                              ? "border-rose-300/40 bg-rose-400/15 text-rose-100"
                              : "border-white/10 bg-white/5 text-white/60",
                        )}
                      >
                        {isComplete ? <Check className="size-4" /> : `0${index + 1}`}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{t(STEP_LABEL_KEYS[index])}</p>
                        <p className="text-xs text-white/45">
                          {t(STEP_DESCRIPTION_KEYS[index])}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
            <div className="flex min-h-0 flex-col px-5 py-5 sm:px-7 sm:py-6">
              <div className="min-h-0 lg:flex-1 lg:overflow-y-auto">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -18 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="mx-auto w-full max-w-3xl"
                  >
                    {step === 0 ? (
                      <div className="space-y-8 pb-2">
                        <div className="max-w-2xl">
                          <p className="text-sm uppercase tracking-[0.28em] text-white/35">
                            {t("step1")}
                          </p>
                          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                            {t("nameYourGame")}
                          </h2>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            {t("nameYourGameDescription")}
                          </p>
                        </div>

                        <div className="grid gap-5">
                          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <label htmlFor="wizard-game-name" className="text-sm font-medium text-white">
                              {t("gameName")}
                            </label>
                            <Input
                              id="wizard-game-name"
                              value={name}
                              onChange={(event) => handleNameChange(event.target.value)}
                              maxLength={MAX_NAME_LENGTH}
                              placeholder={t("gameNamePlaceholder")}
                              disabled={loading}
                              className="mt-3 h-14 rounded-2xl border-white/10 bg-[#1f0c11] text-base text-white placeholder:text-white/25 focus-visible:border-rose-300/30 focus-visible:ring-rose-300/20"
                            />
                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className={cn("text-rose-200", !nameError && "invisible")}>
                                {nameError ?? "Placeholder"}
                              </span>
                              <span className="text-white/35">
                                {name.trim().length}/{MAX_NAME_LENGTH}
                              </span>
                            </div>
                          </div>

                          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                            <label htmlFor="wizard-game-description" className="text-sm font-medium text-white">
                              {t("description")}
                            </label>
                            <Textarea
                              id="wizard-game-description"
                              value={description}
                              onChange={(event) => handleDescriptionChange(event.target.value)}
                              maxLength={MAX_DESCRIPTION_LENGTH}
                              placeholder={t("descriptionPlaceholder")}
                              disabled={loading}
                              className="mt-3 min-h-32 rounded-[1.35rem] border-white/10 bg-[#1f0c11] text-base leading-7 text-white placeholder:text-white/25 focus-visible:border-rose-300/30 focus-visible:ring-rose-300/20"
                            />
                            <div className="mt-3 flex items-center justify-between text-xs text-white/35">
                              <span>{t("setToneHelper")}</span>
                              <span>{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {step === 1 ? (
                      <div className="space-y-8 pb-2">
                        <div className="max-w-2xl">
                          <p className="text-sm uppercase tracking-[0.28em] text-white/35">
                            {t("step2")}
                          </p>
                          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                            {t("chooseGameFormat")}
                          </h2>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            {t("chooseGameFormatDescription")}
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {GAME_FORMAT_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isSelected = selectedGameFormat?.value === option.value;

                            return (
                              <motion.button
                                key={option.value}
                                type="button"
                                onClick={() => handleGameFormatChange(option.value)}
                                disabled={loading}
                                whileHover={{ y: -3, scale: 1.01 }}
                                whileTap={{ scale: 0.985 }}
                                className={cn(
                                  "group relative overflow-hidden rounded-[1.6rem] border p-5 text-left transition-all",
                                  isSelected
                                    ? "border-white/20 bg-white/[0.08] shadow-[0_0_36px_rgba(244,63,94,0.12)]"
                                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
                                  loading && "cursor-not-allowed opacity-70",
                                )}
                              >
                                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80", option.gradientClass)} />
                                <div className="absolute inset-0 bg-[linear-gradient(165deg,rgba(11,4,6,0.0)_0%,rgba(11,4,6,0.82)_85%)]" />

                                <div className="relative flex h-full flex-col justify-between gap-6">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex size-12 items-center justify-center rounded-[1rem] border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                                      <Icon className={cn("size-5", isSelected ? option.iconClass : "text-white/70")} />
                                    </div>
                                    <Badge
                                      className={cn(
                                        "rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.22em]",
                                        isSelected
                                          ? option.badgeClass
                                          : "border-white/10 bg-white/5 text-white/45",
                                      )}
                                    >
                                      {isSelected ? tCommon("selected") : t("format")}
                                    </Badge>
                                  </div>

                                  <div>
                                    <p className="text-xl font-semibold tracking-tight text-white">
                                      {formatLabelMap[option.value]}
                                    </p>
                                    <p className="mt-3 max-w-md text-sm leading-6 text-white/65">
                                      {formatDescriptionMap[option.value]}
                                    </p>
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {step === 2 ? (
                      <div className="space-y-8 pb-2">
                        <div className="max-w-2xl">
                          <p className="text-sm uppercase tracking-[0.28em] text-white/35">
                            {t("step3")}
                          </p>
                          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                            {t("chooseGenre")}
                          </h2>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            {t("chooseGenreDescription", { format: formatLabelMap[selectedGameFormat?.value ?? ""]?.toLowerCase() ?? "game" })}
                          </p>
                        </div>

                        <GenreSelector
                          value={genre}
                          gameFormat={selectedGameFormat?.value ?? null}
                          onChange={(nextGenre) => {
                            setGenre(nextGenre);
                            if (submitError) setSubmitError(null);
                          }}
                        />
                      </div>
                    ) : null}

                    {step === 3 ? (
                      <div className="space-y-8 pb-2">
                        <div className="max-w-2xl">
                          <p className="text-sm uppercase tracking-[0.28em] text-white/35">
                            {t("step4")}
                          </p>
                          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                            {t("reviewAndConfirm")}
                          </h2>
                          <p className="mt-3 text-sm leading-6 text-white/60">
                            {t("reviewDescription")}
                          </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                              {t("nameLabel")}
                            </p>
                            <p className="mt-3 text-lg font-semibold text-white">{previewName}</p>
                          </div>
                          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                              {t("gameType")}
                            </p>
                            <p className="mt-3 text-lg font-semibold text-white">
                              {selectedGameFormat ? formatLabelMap[selectedGameFormat.value] : t("choose2dOr3d")}
                            </p>
                          </div>
                          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                              {t("genreLabel")}
                            </p>
                            <p className="mt-3 text-lg font-semibold text-white">
                              {selectedGenre?.displayName ?? t("selectGenre")}
                            </p>
                          </div>
                          <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-white/35">
                              {t("launchMode")}
                            </p>
                            <p className="mt-3 text-lg font-semibold text-white">{t("openEditorInstantly")}</p>
                          </div>
                        </div>

                        {submitError ? (
                          <div className="rounded-[1.4rem] border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                            {submitError}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-5 flex flex-col gap-4 border-t border-white/8 pt-5">
                <div className="text-sm text-white/40">
                  {keyboardHint}
                </div>

                <div className="flex min-h-12 items-center justify-end">
                  {step === 3 ? (
                    <Button
                      type="button"
                      onClick={handleCreate}
                      disabled={loading || !canReview}
                      className="h-12 rounded-full bg-rose-500 px-6 text-white hover:bg-rose-400"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {t("creatingGame")}
                        </>
                      ) : (
                        <>
                          {t("enterGameMaker")}
                          <Wand2 className="size-4" />
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <aside className="relative min-h-0 border-t border-white/8 bg-[#19080d]/80 lg:border-l lg:border-t-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.22),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_30%)]" />
              <div className="relative flex h-full min-h-0 flex-col px-5 py-5 sm:px-6 sm:py-6 lg:overflow-y-auto">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">
                      {t("livePreview")}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      {t("cardUpdatesWithChoice")}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/45">
                    {step + 1}/4
                  </div>
                </div>

                <motion.div
                  layout
                  className="relative flex min-h-[320px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#220d13] shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:min-h-0 lg:self-start"
                >
                  <div className={cn("absolute inset-0 bg-gradient-to-br", selectedGenre?.gradientClass ?? selectedGameFormat?.gradientClass ?? "from-white/10 via-transparent to-transparent")} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(11,4,6,0.0)_35%,rgba(11,4,6,0.88)_100%)]" />

                  <div className="relative flex min-h-24 items-start justify-between px-5 py-4 sm:min-h-28 sm:px-6 sm:py-5">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.2em] uppercase", selectedGenre?.pillClass ?? "border-white/15 bg-white/10 text-white/80")}>
                        {selectedGenre?.displayName ?? t("chooseAGenre")}
                      </Badge>
                      <Badge className={cn("rounded-full border px-3 py-1 text-[11px] font-medium tracking-[0.2em] uppercase", selectedGameFormat?.badgeClass ?? "border-white/15 bg-white/10 text-white/60")}>
                        {selectedGameFormat ? formatLabelMap[selectedGameFormat.value] : t("choose2dOr3d")}
                      </Badge>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/45">
                      {t("reviewCard")}
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center px-6 py-1 text-[3.4rem] sm:text-[4rem]">
                    <span aria-hidden="true">
                      {selectedGenre?.emoji ?? (selectedGameFormat?.value === "2d" ? "🕹️" : selectedGameFormat?.value === "3d" ? "🎲" : "🎮")}
                    </span>
                  </div>

                  <div className="relative space-y-3 px-5 pb-5 pt-2 sm:px-6">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">
                        {t("gameName")}
                      </p>
                      <h3 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {previewName}
                      </h3>
                    </div>

                    <p className="line-clamp-3 text-sm leading-6 text-white/65 sm:line-clamp-4">
                      {previewDescription}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                        {selectedGameFormat ? formatLabelMap[selectedGameFormat.value] : t("pickAFormat")}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                        {t("genreAtoms")}
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
                        {t("aiReadyWorkspace")}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

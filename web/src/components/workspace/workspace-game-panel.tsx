"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Expand, Hammer, Loader2, Minimize, Paintbrush, RotateCcw, ShieldCheck, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GameFrame } from "@/components/playground/game-frame";
import { gamePanelReveal } from "./workspace-animations";
import { cn } from "@/lib/utils";
import type { AgentName, WarRoomEvent, WarRoomWithFeed } from "@/lib/types";
import type { WarRoomTaskState } from "@/lib/war-room-state";

// ─── Agent Icon Map ──────────────────────────────────────────────────────────

const AGENT_ICON: Record<AgentName, typeof Bot> = {
  jarvis: Bot,
  forge: Hammer,
  pixel: Paintbrush,
  checker: ShieldCheck,
};

// ─── Agent Color Themes (CSS values for smooth transitions) ──────────────────

type AgentThemeCSS = {
  bg: string;
  glow: string;
  bar: string;
  border: string;
  iconBg: string;
  text: string;
};

const AGENT_THEME_CSS: Record<AgentName | "default", AgentThemeCSS> = {
  default: {
    bg: "rgba(27,11,15,0.95)",
    glow: "rgba(251,113,133,0.22)",
    bar: "linear-gradient(90deg,#fb7185 0%,#f472b6 38%,#60a5fa 100%)",
    border: "rgba(251,113,133,0.18)",
    iconBg: "rgba(244,63,94,0.10)",
    text: "#fda4af",
  },
  jarvis: {
    bg: "rgba(19,5,27,0.95)",
    glow: "rgba(217,70,239,0.22)",
    bar: "linear-gradient(90deg,#d946ef 0%,#a855f7 60%,#7c3aed 100%)",
    border: "rgba(217,70,239,0.20)",
    iconBg: "rgba(217,70,239,0.10)",
    text: "#f0abfc",
  },
  forge: {
    bg: "rgba(3,14,27,0.95)",
    glow: "rgba(56,189,248,0.22)",
    bar: "linear-gradient(90deg,#38bdf8 0%,#60a5fa 50%,#818cf8 100%)",
    border: "rgba(56,189,248,0.20)",
    iconBg: "rgba(14,165,233,0.10)",
    text: "#7dd3fc",
  },
  pixel: {
    bg: "rgba(3,20,12,0.95)",
    glow: "rgba(52,211,153,0.22)",
    bar: "linear-gradient(90deg,#34d399 0%,#10b981 50%,#059669 100%)",
    border: "rgba(52,211,153,0.20)",
    iconBg: "rgba(52,211,153,0.10)",
    text: "#6ee7b7",
  },
  checker: {
    bg: "rgba(20,15,3,0.95)",
    glow: "rgba(251,191,36,0.22)",
    bar: "linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)",
    border: "rgba(251,191,36,0.20)",
    iconBg: "rgba(251,191,36,0.10)",
    text: "#fcd34d",
  },
};

// ─── Simulated Code Lines per Agent ─────────────────────────────────────────

const AGENT_CODE_LINES: Record<AgentName | "default", string[]> = {
  default: [
    "// Initializing pipeline...",
    "await warmUpAgents(['jarvis', 'forge', 'pixel', 'checker']);",
    "// Agents ready",
  ],
  jarvis: [
    "// Jarvis: analyzing game schema...",
    "const schema = await loadGameSchema(gameName);",
    "const tasks = planPipelineTasks(schema, userPrompt);",
    "await dispatchWarRoom({ tasks, agents: ['forge', 'pixel', 'checker'] });",
    "// Pipeline dispatched — monitoring agent states",
  ],
  forge: [
    "// Forge: writing game logic...",
    "import Phaser from 'phaser';",
    "class GameScene extends Phaser.Scene {",
    "  preload() {",
    "    this.load.image('player', 'assets/player.png');",
    "  }",
    "  create() {",
    "    this.player = this.physics.add.sprite(400, 300, 'player');",
    "    this.cursors = this.input.keyboard.createCursorKeys();",
    "  }",
    "  update() {",
    "    const vel = this.cursors.left.isDown ? -160 : this.cursors.right.isDown ? 160 : 0;",
    "    this.player.setVelocityX(vel);",
    "  }",
    "}",
  ],
  pixel: [
    "// Pixel: generating visual assets...",
    "const palette = extractColorPalette(theme);",
    "await renderSprite({ id: 'player', size: 32, palette });",
    "await renderBackground({ layers: 3, parallax: true });",
    "await compileAtlas({ sprites: allSprites, output: 'assets/atlas.png' });",
    "// Assets compiled ✓",
  ],
  checker: [
    "// Checker: validating game build...",
    "const result = await runBuildValidation(gameName);",
    "assert(result.syntaxErrors === 0, 'No syntax errors');",
    "assert(result.assetsMissing === 0, 'All assets present');",
    "assert(result.performanceScore >= 60, 'Performance OK');",
    "// Validation passed ✓",
  ],
};

// ─── Sub-component: Thinking Narration ───────────────────────────────────────

function ThinkingNarration({ phase, typedCount }: { phase: string | null; typedCount: number }) {
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={phase ?? "idle"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className="max-w-[240px] text-center text-[11px] text-white/40 font-mono min-h-[16px]"
      >
        {!phase ? (
          <motion.span
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            ...
          </motion.span>
        ) : (
          <>
            {phase.slice(0, typedCount)}
            {typedCount < phase.length && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.4, repeat: Infinity }}
                className="inline-block w-1 h-[10px] bg-white/40 align-middle ml-px"
              />
            )}
          </>
        )}
      </motion.p>
    </AnimatePresence>
  );
}

// ─── Sub-component: Task Timeline Rail ───────────────────────────────────────

function TaskTimelineRail({
  tasks,
  completedCount,
  totalCount,
}: {
  tasks: WarRoomTaskState[];
  completedCount: number;
  totalCount: number;
}) {
  const sorted = useMemo(
    () => [...tasks].sort((a, b) => a.task_number - b.task_number),
    [tasks],
  );
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (sorted.length === 0) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-8 z-30 pointer-events-none flex flex-col items-center py-5">
      {/* Track line */}
      <div className="absolute inset-y-5 left-1/2 w-px -translate-x-1/2 bg-white/8" />
      {/* Animated progress fill */}
      <motion.div
        className="absolute top-5 left-1/2 w-px -translate-x-1/2 origin-top"
        style={{ background: "rgba(251,113,133,0.45)" }}
        animate={{ height: `${progressPct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {/* Task nodes */}
      {sorted.map((task) => {
        const isRunning = task.status === "running" || task.status === "assigned";
        const isComplete = task.status === "completed";
        const isFailed = task.status === "failed";
        return (
          <motion.div
            key={task.id}
            className="relative z-10 rounded-full"
            style={{
              flex: 1,
              width: 7,
              maxHeight: 7,
              margin: "auto 0",
              background: isFailed
                ? "rgba(251,113,133,0.9)"
                : isComplete
                  ? "rgba(251,113,133,0.65)"
                  : isRunning
                    ? "rgba(255,255,255,0.65)"
                    : "rgba(255,255,255,0.15)",
            }}
            animate={isRunning ? { scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] } : {}}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WorkspaceGamePanelProps {
  gameName: string;
  gameFormat: "2d" | "3d" | null;
  // Pipeline state lifted from GameWorkspace — single subscription, no duplicate channels
  pipelineWarRoom?: WarRoomWithFeed | null;
  pipelineTasks?: WarRoomTaskState[];
  pipelineEvents?: WarRoomEvent[];
  isPipelineComplete?: boolean;
}

export function WorkspaceGamePanel({
  gameName,
  gameFormat,
  pipelineWarRoom = null,
  pipelineTasks = [],
  pipelineEvents = [],
  isPipelineComplete = false,
}: WorkspaceGamePanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [shouldLoadIframe, setShouldLoadIframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCompletionGlow, setShowCompletionGlow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeKey = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const hasCelebratedRef = useRef(false);

  // Code preview typewriter state
  const [codeLines, setCodeLines] = useState<string[]>([]);
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const codeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Thinking narration typewriter state
  const [typedCharCount, setTypedCharCount] = useState(0);
  const phaseRef = useRef<string | null>(null);
  const phaseIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const warRoom = pipelineWarRoom;
  const tasks = pipelineTasks;
  const events = pipelineEvents;

  const isPipelineRunning = !!warRoom && !isPipelineComplete;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const totalCount = tasks.length;
  const progress =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const activeTask =
    tasks.find((t) => t.status === "running" || t.status === "assigned") ??
    null;

  const latestEvent =
    events.length > 0
      ? [...events].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0]
      : null;

  // Derive current agent theme
  const currentAgent = activeTask?.assigned_agent ?? null;
  const theme = AGENT_THEME_CSS[currentAgent ?? "default"];

  // Derive active thinking phase
  const activePhase = activeTask?.active_phase ?? null;

  // Reset loading when pipeline completes so the iframe spinner shows briefly
  useEffect(() => {
    if (isPipelineComplete && warRoom) {
      setIsLoading(true);
    }
  }, [isPipelineComplete, warRoom]);

  // Defer iframe loading until workspace shell is interactive
  useEffect(() => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = requestIdleCallback(() => setShouldLoadIframe(true), { timeout: 500 });
      return () => cancelIdleCallback(id);
    }
    // Fallback for Safari
    const timer = setTimeout(() => setShouldLoadIframe(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Feature 2: Code preview typewriter — update when active task changes
  useEffect(() => {
    if (codeIntervalRef.current) clearInterval(codeIntervalRef.current);
    const lines = AGENT_CODE_LINES[activeTask?.assigned_agent ?? "default"];
    setCodeLines(lines);
    setVisibleLineCount(0);
    let i = 0;
    codeIntervalRef.current = setInterval(() => {
      i++;
      setVisibleLineCount(i);
      if (i >= lines.length && codeIntervalRef.current) {
        clearInterval(codeIntervalRef.current);
      }
    }, 220);
    return () => {
      if (codeIntervalRef.current) clearInterval(codeIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.task_number]);

  // Feature 5: Thinking narration typewriter — update when phase changes
  useEffect(() => {
    if (phaseIntervalRef.current) clearInterval(phaseIntervalRef.current);
    if (!activePhase || phaseRef.current === activePhase) return;
    phaseRef.current = activePhase;
    setTypedCharCount(0);
    let i = 0;
    phaseIntervalRef.current = setInterval(() => {
      i++;
      setTypedCharCount(i);
      if (i >= activePhase.length && phaseIntervalRef.current) {
        clearInterval(phaseIntervalRef.current);
      }
    }, 28);
    return () => {
      if (phaseIntervalRef.current) clearInterval(phaseIntervalRef.current);
    };
  }, [activePhase]);

  // Feature 3: Pipeline completion celebration
  useEffect(() => {
    if (!isPipelineComplete || hasCelebratedRef.current) return;
    hasCelebratedRef.current = true;
    setShowCompletionGlow(true);

    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.55 },
        colors: ["#fb7185", "#f472b6", "#60a5fa", "#34d399", "#fbbf24"],
        zIndex: 50,
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#fb7185", "#a855f7"],
          zIndex: 50,
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#38bdf8", "#34d399"],
          zIndex: 50,
        });
      }, 250);
    });

    toast.success("Game built! 🎮", {
      description: "Your game is ready to play.",
      duration: 4000,
    });
  }, [isPipelineComplete]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    iframeKey.current += 1;
    setRefreshKey(iframeKey.current);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const runtimeLabel = gameFormat === "2d" ? "Phaser" : "Three.js";

  return (
    <motion.div
      ref={containerRef}
      variants={gamePanelReveal}
      initial="hidden"
      animate="visible"
      className="flex-1 min-w-0 relative rounded-br-[1.25rem] bg-black/60 overflow-hidden"
    >
      {/* Top overlay bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <span className="text-[11px] text-white/30 font-medium truncate">
          {gameName}
        </span>
        <div className="flex items-center gap-1 pointer-events-auto">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg bg-white/8 text-white/50 hover:bg-white/15 hover:text-white"
              onClick={handleRefresh}
            >
              <RotateCcw className="size-3" />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg bg-white/8 text-white/50 hover:bg-white/15 hover:text-white"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize className="size-3" />
              ) : (
                <Expand className="size-3" />
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Pipeline overlay / loading overlay */}
      <AnimatePresence mode="wait">
        {isPipelineRunning ? (
          // Feature 1: key={currentAgent} triggers a cross-fade when the active agent changes
          <motion.div
            key={`pipeline-${currentAgent ?? "default"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ background: theme.bg }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 px-8 text-center"
          >
            {/* Feature 4: Task Timeline Rail — absolutely positioned on right edge */}
            <TaskTimelineRail
              tasks={tasks}
              completedCount={completedCount}
              totalCount={totalCount}
            />

            {/* Header */}
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{
                  boxShadow: [
                    `0 0 0px rgba(0,0,0,0)`,
                    `0 0 28px ${theme.glow}`,
                    `0 0 0px rgba(0,0,0,0)`,
                  ],
                }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="flex size-14 items-center justify-center rounded-[1.4rem]"
                style={{
                  border: `1px solid ${theme.border}`,
                  background: theme.iconBg,
                  color: theme.text,
                }}
              >
                {currentAgent
                  ? (() => { const Icon = AGENT_ICON[currentAgent]; return <Icon className="size-6" />; })()
                  : <Sparkles className="size-6" />
                }
              </motion.div>
              <div>
                <p className="text-base font-semibold text-white">
                  {currentAgent
                    ? `${currentAgent.charAt(0).toUpperCase() + currentAgent.slice(1)} is building...`
                    : "Building your game..."}
                </p>
                {warRoom?.prompt && (
                  <p className="mt-1 max-w-[220px] truncate text-xs text-white/35">
                    {warRoom.prompt}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-[260px]">
              <div className="mb-2 flex items-center justify-between text-[11px] text-white/40">
                <span>Pipeline progress</span>
                <span>{completedCount}/{totalCount || "?"} complete</span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: theme.bar }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Active task card */}
            {activeTask ? (
              <div className="w-full max-w-[260px] rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-left">
                {activeTask.assigned_agent && (() => {
                  const Icon = AGENT_ICON[activeTask.assigned_agent];
                  return (
                    <div
                      className="mb-2 flex items-center gap-2 text-[11px] font-medium"
                      style={{ color: theme.text }}
                    >
                      <Icon className="size-3.5" />
                      <span className="capitalize">{activeTask.assigned_agent}</span>
                    </div>
                  );
                })()}
                <p className="text-sm font-medium text-white/88">
                  #{activeTask.task_number}: {activeTask.title}
                </p>
              </div>
            ) : (
              <div className="w-full max-w-[260px] rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-xs text-white/40">Waiting for agents to start...</p>
              </div>
            )}

            {/* Feature 2: Live code preview terminal */}
            {activeTask && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="w-full max-w-[280px] rounded-[0.8rem] border border-white/8 p-3 font-mono text-[10px] text-left overflow-hidden"
                style={{ background: "rgba(0,0,0,0.45)", maxHeight: 96 }}
              >
                {codeLines.slice(0, visibleLineCount).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15 }}
                    className="leading-5"
                    style={{ color: theme.text + "cc" }}
                  >
                    {line}
                  </motion.div>
                ))}
                {/* Blinking cursor */}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-1.5 h-[10px] align-middle ml-0.5"
                  style={{ background: theme.text + "99" }}
                />
              </motion.div>
            )}

            {/* Feature 5: Agent thinking narration */}
            <ThinkingNarration phase={activePhase} typedCount={typedCharCount} />

            {/* Latest event */}
            {latestEvent && (
              <p className="max-w-[240px] truncate text-[11px] text-white/28">
                {latestEvent.event_type.replaceAll("_", " ")}
              </p>
            )}
          </motion.div>
        ) : isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-[#1b0b0f]/90"
          >
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="size-6 text-rose-400" />
              </motion.div>
              <span className="text-xs text-white/40">
                Loading {runtimeLabel} game...
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Feature 3: Completion glow sweep — outside AnimatePresence so it persists as overlay exits */}
      <AnimatePresence>
        {showCompletionGlow && !isLoading && (
          <motion.div
            key="completion-glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.5, times: [0, 0.15, 0.7, 1] }}
            onAnimationComplete={() => setShowCompletionGlow(false)}
            className="pointer-events-none absolute inset-0 z-10 rounded-br-[1.25rem]"
            style={{
              boxShadow:
                "inset 0 0 0 2px rgba(251,113,133,0.6), inset 0 0 60px rgba(251,113,133,0.12)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Game iframe — always loads in background so it's ready when the overlay fades.
          game-player.html shows "Watching for builds..." until a bundle is available. */}
      {shouldLoadIframe && (
        <GameFrame
          key={refreshKey}
          gameName={gameName}
          gameFormat={gameFormat}
          onLoad={handleIframeLoad}
        />
      )}

      {/* Bottom gradient with link */}
      <div className="absolute bottom-0 inset-x-0 z-10 flex items-end justify-end px-3 py-2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none">
        <a
          href={`/play/${gameName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors"
        >
          <ExternalLink className="size-3" />
          Open in new tab
        </a>
      </div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Bot, Hammer, Paintbrush, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeInUp, staggerContainer } from "./dashboard-animations";

type AgentStatus = "online" | "working" | "idle" | "error";

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  model: string;
  icon: typeof Bot;
  color: string;
  glowColor: string;
  bgColor: string;
}

interface AgentState extends AgentInfo {
  status: AgentStatus;
  latency: number;
  lastPing: string;
}

const AGENTS: AgentInfo[] = [
  {
    id: "jarvis",
    name: "Jarvis",
    role: "Orchestrator",
    model: "Gemini 3.1 Pro",
    icon: Bot,
    color: "text-purple-400",
    glowColor: "shadow-purple-500/40",
    bgColor: "bg-purple-500/15",
  },
  {
    id: "forge",
    name: "Forge",
    role: "Builder",
    model: "Gemini 3.1 Pro",
    icon: Hammer,
    color: "text-blue-400",
    glowColor: "shadow-blue-500/40",
    bgColor: "bg-blue-500/15",
  },
  {
    id: "pixel",
    name: "Pixel",
    role: "Designer",
    model: "Gemini 3.1 Flash Lite",
    icon: Paintbrush,
    color: "text-green-400",
    glowColor: "shadow-green-500/40",
    bgColor: "bg-green-500/15",
  },
  {
    id: "checker",
    name: "Checker",
    role: "QA",
    model: "Gemini 3.1 Flash Lite",
    icon: ShieldCheck,
    color: "text-amber-400",
    glowColor: "shadow-amber-500/40",
    bgColor: "bg-amber-500/15",
  },
];

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; dotColor: string; pulse: boolean }
> = {
  online: { label: "Online", dotColor: "bg-emerald-400", pulse: false },
  working: { label: "Working", dotColor: "bg-emerald-400", pulse: true },
  idle: { label: "Idle", dotColor: "bg-zinc-500", pulse: false },
  error: { label: "Error", dotColor: "bg-rose-500", pulse: true },
};

function buildAgentStates(seed = 0): AgentState[] {
  const statuses: AgentStatus[] = ["online", "working", "idle", "online"];
  return AGENTS.map((agent, i) => ({
    ...agent,
    status: statuses[i],
    latency: 16 + ((i * 7 + seed * 5) % 17),
    lastPing: "just now",
  }));
}

function getSignalHeight(agent: AgentState, barIndex: number, seed: number): number {
  const baseSeed = agent.id.charCodeAt(0) + barIndex * 11 + seed * 7;
  if (agent.status === "error" && barIndex > 2) {
    return 25 + (baseSeed % 15);
  }

  return 40 + (baseSeed % 60);
}

function AgentRow({ agent, index }: { agent: AgentState; index: number }) {
  const Icon = agent.icon;
  const statusCfg = STATUS_CONFIG[agent.status];
  const [latency, setLatency] = useState(agent.latency);
  const [isHovered, setIsHovered] = useState(false);

  // Simulate latency jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency((current) => 10 + ((current + index * 3 + 7) % 35));
    }, 3000 + index * 800);
    return () => clearInterval(interval);
  }, [index]);

  return (
    <motion.div
      variants={fadeInUp}
      className="group relative flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.025] p-3 transition-all hover:border-white/12 hover:bg-white/[0.045]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Powered by tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black/90 px-3 py-1.5 text-[11px] font-medium text-white/80 shadow-lg backdrop-blur-sm"
          >
            POWERED BY {agent.model.toUpperCase()}
            <div className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-black/90" />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Agent icon */}
      <motion.div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          agent.bgColor,
        )}
        whileHover={{ scale: 1.1, rotate: 5 }}
      >
        <Icon className={cn("size-4", agent.color)} />
      </motion.div>

      {/* Name & role */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">{agent.name}</p>
          <span className="text-[10px] uppercase tracking-wider text-white/30">
            {agent.role}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {/* Status dot */}
          <span
            className={cn(
              "size-1.5 rounded-full",
              statusCfg.dotColor,
              statusCfg.pulse && "animate-pulse",
            )}
          />
          <span className="text-[11px] text-white/45">{statusCfg.label}</span>
          <span className="text-[10px] text-white/25">&bull;</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={latency}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "text-[11px] tabular-nums",
                latency < 30 ? "text-emerald-400/70" : "text-amber-400/70",
              )}
            >
              {latency}ms
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Health bar mini */}
      <div className="flex h-6 w-12 items-end gap-[2px]">
        {Array.from({ length: 5 }).map((_, i) => {
          const h = getSignalHeight(agent, i, index);
          return (
            <motion.div
              key={i}
              className={cn(
                "w-full rounded-sm",
                agent.status === "error" && i > 2
                  ? "bg-rose-500/50"
                  : agent.status === "idle"
                    ? "bg-white/10"
                    : `${agent.bgColor}`,
              )}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{
                duration: 0.6,
                delay: 0.1 * i + index * 0.08,
                ease: "easeOut",
              }}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

export function DashboardAgentHealth() {
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [agents, setAgents] = useState<AgentState[]>(() => buildAgentStates(0));
  const [isPinging, setIsPinging] = useState(false);

  const onlineCount = agents.filter(
    (a) => a.status === "online" || a.status === "working",
  ).length;

  const handlePing = () => {
    setIsPinging(true);
    setTimeout(() => {
      setRefreshSeed((seed) => {
        const nextSeed = seed + 1;
        setAgents(buildAgentStates(nextSeed));
        return nextSeed;
      });
      setIsPinging(false);
    }, 1200);
  };

  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-5 shadow-[0_18px_60px_rgba(24,8,10,0.22)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-rose-500/15">
            <Activity className="size-3.5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Agent Pipeline</h3>
            <p className="text-[11px] text-white/40">
              {onlineCount}/{agents.length} active
            </p>
          </div>
        </div>

        {/* Ping button */}
        <motion.button
          type="button"
          onClick={handlePing}
          disabled={isPinging}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-medium transition-all",
            isPinging
              ? "border-rose-400/30 bg-rose-500/10 text-rose-400"
              : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10 hover:text-white",
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isPinging ? (
            <span className="flex items-center gap-1.5">
              <motion.span
                className="inline-block size-1.5 rounded-full bg-rose-400"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              Pinging...
            </span>
          ) : (
            "Ping All"
          )}
        </motion.button>
      </div>

      {/* Overall health ring */}
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
        <div className="relative size-10">
          <svg viewBox="0 0 36 36" className="size-full -rotate-90">
            <circle
              cx="18" cy="18" r="14" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="3"
            />
            <motion.circle
              cx="18" cy="18" r="14" fill="none"
              stroke="#f43f5e" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 14}
              initial={{ strokeDashoffset: 2 * Math.PI * 14 }}
              animate={{
                strokeDashoffset:
                  2 * Math.PI * 14 * (1 - onlineCount / agents.length),
              }}
              transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
            {Math.round((onlineCount / agents.length) * 100)}%
          </span>
        </div>
        <div>
          <p className="text-xs font-medium text-white">Pipeline Health</p>
          <p className="text-[11px] text-white/40">
            All systems nominal
          </p>
        </div>
      </div>

      {/* Agent rows */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="mt-3 space-y-2"
      >
        {agents.map((agent, i) => (
          <AgentRow key={agent.id} agent={agent} index={i} />
        ))}
      </motion.div>
    </motion.section>
  );
}

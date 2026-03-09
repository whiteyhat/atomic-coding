"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Hammer, Paintbrush, ShieldCheck, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentStatus, AgentName } from "@/lib/agent-status";

interface AgentConfig {
  icon: typeof Bot;
  color: string;
  bgColor: string;
  dotColor: string;
}

const AGENT_CONFIG: Record<AgentName, AgentConfig> = {
  jarvis: {
    icon: Bot,
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    dotColor: "bg-purple-400",
  },
  forge: {
    icon: Hammer,
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    dotColor: "bg-blue-400",
  },
  pixel: {
    icon: Paintbrush,
    color: "text-green-400",
    bgColor: "bg-green-500/15",
    dotColor: "bg-green-400",
  },
  checker: {
    icon: ShieldCheck,
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
    dotColor: "bg-amber-400",
  },
};

const ALL_AGENTS: AgentName[] = ["jarvis", "forge", "pixel", "checker"];

interface AgentStatusDropdownProps {
  activeAgent: AgentStatus | null;
}

export function AgentStatusDropdown({ activeAgent }: AgentStatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  const isIdle = !activeAgent || activeAgent.state === "done";
  const activeConfig = activeAgent ? AGENT_CONFIG[activeAgent.name] : null;

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all",
          isIdle
            ? "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:bg-white/10"
            : "border-rose-500/30 bg-rose-500/10 text-rose-400"
        )}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        {isIdle ? (
          <>
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Ready
          </>
        ) : (
          <>
            <motion.span
              className={cn("size-1.5 rounded-full", activeConfig?.dotColor)}
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            {activeAgent.label}
          </>
        )}
        <ChevronDown
          className={cn(
            "size-3 opacity-50 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl border border-white/10 bg-[#2a1014]/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/30">
              Agent Pipeline
            </p>
            {ALL_AGENTS.map((name) => {
              const config = AGENT_CONFIG[name];
              const Icon = config.icon;
              const isActive = activeAgent?.name === name && activeAgent.state === "working";

              return (
                <div
                  key={name}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
                >
                  <div
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg",
                      config.bgColor
                    )}
                  >
                    <Icon className={cn("size-3.5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white capitalize">
                      {name}
                    </p>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isActive ? config.dotColor : "bg-white/15"
                      )}
                    />
                    {isActive && (
                      <motion.span
                        className={cn("absolute size-1.5 rounded-full", config.dotColor)}
                        animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

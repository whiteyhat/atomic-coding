"use client";

import { type ReactNode, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { sidebarReveal } from "./workspace-animations";
import type { SidebarTab } from "./game-workspace";

const TABS = [
  { id: "chat" as const, label: "Chat", icon: MessageSquare, shortcut: "1" },
  { id: "config" as const, label: "Config", icon: Settings, shortcut: "2" },
];

interface WorkspaceSidebarProps {
  tab: SidebarTab;
  setTab: (tab: SidebarTab) => void;
  sidebarWidth: number;
  children: ReactNode;
}

export function WorkspaceSidebar({
  tab,
  setTab,
  sidebarWidth,
  children,
}: WorkspaceSidebarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <motion.aside
      variants={sidebarReveal}
      initial={mounted ? "hidden" : false}
      animate="visible"
      className="shrink-0 flex flex-col rounded-bl-[1.25rem] border-r border-white/8 bg-[#2a1014]/95 overflow-hidden"
      style={{ width: sidebarWidth }}
    >
      {/* Tab bar */}
      <div
        className="flex items-stretch h-11 border-b border-white/[0.06] shrink-0 px-1.5 gap-0.5"
        role="tablist"
      >
        {TABS.map(({ id, label, icon: Icon, shortcut }) => {
          const isActive = tab === id;
          return (
            <motion.button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1 my-1.5 rounded-xl text-xs font-medium transition-all",
                isActive
                  ? "text-rose-400"
                  : "text-white/45 hover:bg-white/8 hover:text-white/70"
              )}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {isActive && (
                <motion.div
                  layoutId="workspace-tab"
                  className="absolute inset-0 rounded-xl border border-rose-400/20 bg-rose-500/15"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
              <Icon className="relative size-3.5" />
              <span className="relative">{label}</span>
              <span className="relative text-[9px] text-white/20 ml-0.5 hidden lg:inline">
                {shortcut}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </motion.aside>
  );
}

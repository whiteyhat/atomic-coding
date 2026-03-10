"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Home,
  LayoutGrid,
  Layers,
  Plus,
  Settings,
  Shrimp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { slideInLeft, fadeInUp, staggerContainer } from "./dashboard-animations";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { icon: Home, label: "Home", id: "home", href: "/dashboard" },
  { icon: BarChart3, label: "Analytics", id: "stats", href: "/analytics" },
  { icon: LayoutGrid, label: "Library", id: "library", href: "/library" },
  { icon: Shrimp, label: "OpenClaw", id: "openclaw", href: "/openclaw" },
  { icon: Settings, label: "Settings", id: "settings", href: "/settings" },
] as const;

interface DashboardSidebarProps {
  onCreateClick?: () => void;
  activeId?: string;
}

export function DashboardSidebar({
  onCreateClick,
  activeId: activeIdProp,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const activeId =
    activeIdProp ??
    (pathname.startsWith("/analytics")
      ? "stats"
      : pathname.startsWith("/library")
        ? "library"
        : pathname.startsWith("/openclaw")
          ? "openclaw"
          : pathname.startsWith("/settings")
            ? "settings"
            : "home");

  return (
    <TooltipProvider delayDuration={150}>
      <motion.aside
        variants={slideInLeft}
        initial="hidden"
        animate="visible"
        className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[82px] shrink-0 flex-col rounded-[2.3rem] border border-white/8 bg-[#2a1014] p-3 shadow-[0_18px_55px_rgba(24,8,10,0.4)] lg:flex"
      >
        {/* Logo */}
        <div className="flex items-center justify-center py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard" className="flex size-11 items-center justify-center rounded-2xl bg-white/8 text-white/80 transition hover:bg-white/12">
                <Layers className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={14}
              className="rounded-xl border border-white/10 bg-[#1a0a0e]/95 px-3.5 py-2 text-[13px] font-medium tracking-wide text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(244,63,94,0.08)] backdrop-blur-xl"
            >
              Atomic Coding
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nav Items */}
        <motion.nav
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mt-6 flex flex-1 flex-col items-center gap-1"
        >
          {navItems.map(({ icon: Icon, label, id, href }) => {
            const isActive = id === activeId;

            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <motion.div variants={fadeInUp}>
                    <Link
                      href={href}
                      className={cn(
                        "relative flex size-11 items-center justify-center rounded-2xl transition-all duration-200",
                        isActive
                          ? "bg-rose-500/20 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                          : "text-white/45 hover:bg-white/8 hover:text-white/70",
                      )}
                    >
                      <Icon className="size-[18px]" />
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-2xl border border-rose-400/20 bg-rose-500/10"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                    </Link>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={14}
                  className={cn(
                    "rounded-xl border bg-[#1a0a0e]/95 px-3.5 py-2 text-[13px] font-medium tracking-wide shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl",
                    isActive
                      ? "border-rose-500/20 text-rose-300 shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(244,63,94,0.12)]"
                      : "border-white/10 text-white/90 shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(244,63,94,0.08)]",
                  )}
                >
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </motion.nav>

        {/* Bottom create button */}
        {onCreateClick ? (
          <div className="flex items-center justify-center pb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  onClick={onCreateClick}
                  className="flex size-12 items-center justify-center rounded-full border border-dashed border-white/20 text-white/50 transition-all hover:border-white/40 hover:bg-white/8 hover:text-white"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Plus className="size-5" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={14}
                className="rounded-xl border border-rose-500/15 bg-[#1a0a0e]/95 px-3.5 py-2 text-[13px] font-medium tracking-wide text-rose-300 shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_15px_rgba(244,63,94,0.15)] backdrop-blur-xl"
              >
                Create
              </TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </motion.aside>
    </TooltipProvider>
  );
}

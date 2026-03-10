"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { getTimeOfDayGreeting } from "@/lib/dashboard";
import { useAppAuth } from "@/lib/privy-provider";
import { fadeInUp } from "./dashboard-animations";

interface DashboardHeaderProps {
  displayName: string;
}

export function DashboardHeader({ displayName }: DashboardHeaderProps) {
  const greeting = getTimeOfDayGreeting();
  const { user, logout } = useAppAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const email = user?.email?.address;
  const wallet = user?.wallet?.address;
  const subtitle = email || (wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Account");

  return (
    <motion.header
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="flex items-center justify-between gap-4 px-1 py-2"
    >
      <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
        {greeting},{" "}
        <span className="text-rose-400">{displayName}</span>
      </h1>

      {/* Avatar + account menu */}
      <div ref={menuRef} className="relative">
        <motion.button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="relative size-10 overflow-hidden rounded-full bg-gradient-to-br from-rose-400 via-purple-400 to-blue-400 p-[2px]"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex size-full items-center justify-center rounded-full bg-[#2a1014] text-sm font-semibold text-white">
            {displayName.charAt(0)}
          </div>
        </motion.button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#2a1014] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
            >
              {/* User info */}
              <div className="border-b border-white/8 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400/20 via-purple-400/20 to-blue-400/20">
                    <User className="size-4 text-white/60" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{displayName}</p>
                    <p className="truncate text-[11px] text-white/40">{subtitle}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-1.5">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-white/60 transition hover:bg-white/8 hover:text-white"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
}

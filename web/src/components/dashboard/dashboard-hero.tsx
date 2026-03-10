"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GAME_GENRES } from "@/lib/game-genres";
import { fadeInUp, staggerContainer } from "./dashboard-animations";

const heroGenres = GAME_GENRES.slice(0, 4);

interface DashboardHeroProps {
  onOpenCreate: (genre?: string | null) => void;
}

export function DashboardHero({ onOpenCreate }: DashboardHeroProps) {
  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#311519]/95 shadow-[0_24px_90px_rgba(24,8,10,0.3)]"
    >
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center p-6 md:p-8 lg:p-10">
          <motion.h2
            variants={fadeInUp}
            className="max-w-lg text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-[2.75rem]"
          >
            Turn Your Wildest Idea Into a{" "}
            <span className="text-rose-400">Playable Game</span> in Seconds
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="mt-4 max-w-md text-sm leading-relaxed text-white/60 md:text-base"
          >
            Chat &rarr; Pick Genre &rarr; Instant Game + Token. No coding
            required, just your imagination.
          </motion.p>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="mt-6 flex flex-wrap gap-2"
          >
            {heroGenres.map((genre) => (
              <motion.button
                key={genre.slug}
                variants={fadeInUp}
                type="button"
                onClick={() => onOpenCreate(genre.slug)}
                className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-white/80 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
                whileHover={{ y: -2, scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                {genre.displayName}
              </motion.button>
            ))}
          </motion.div>

          <motion.div variants={fadeInUp} className="mt-8">
            <Button
              className="rounded-full bg-rose-500 px-6 py-3 text-white shadow-[0_4px_24px_rgba(244,63,94,0.3)] hover:bg-rose-400 hover:shadow-[0_6px_32px_rgba(244,63,94,0.4)]"
              onClick={() => onOpenCreate(null)}
            >
              Start Creating
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </motion.div>
        </div>

        <div className="relative hidden min-h-[320px] overflow-hidden lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(244,63,94,0.35),transparent_50%),radial-gradient(circle_at_70%_30%,rgba(168,85,247,0.25),transparent_45%),radial-gradient(circle_at_50%_80%,rgba(251,146,60,0.2),transparent_40%),linear-gradient(135deg,#4d2329_0%,#1b0b0f_100%)]" />

          <motion.div
            className="absolute left-[15%] top-[20%] size-32 rounded-full bg-gradient-to-br from-rose-500/30 to-purple-500/20 blur-xl"
            animate={{ y: [0, -15, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-[25%] right-[20%] size-24 rounded-full bg-gradient-to-br from-amber-400/25 to-rose-400/15 blur-lg"
            animate={{ y: [0, 12, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <motion.div
            className="absolute left-[40%] top-[50%] size-16 rounded-2xl bg-gradient-to-br from-purple-400/30 to-blue-400/20 blur-md"
            animate={{ y: [0, -10, 0], rotate: [0, 8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />

          <div className="absolute right-0 top-0 h-full w-1/2">
            <div className="absolute right-8 top-8 size-40 rounded-3xl border border-white/5 bg-white/[0.02]" />
            <div className="absolute bottom-12 right-16 size-28 rotate-12 rounded-3xl border border-white/5 bg-white/[0.02]" />
          </div>

          <div className="absolute bottom-0 right-4 top-0 flex w-[60%] items-end justify-center">
            <div className="relative h-[85%] w-[70%]">
              <div className="absolute inset-0 bg-gradient-to-t from-[#311519] via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-[80%] rounded-t-[3rem] bg-gradient-to-t from-white/[0.04] to-transparent" />
              <div className="absolute inset-x-[15%] bottom-[40%] h-[35%] rounded-full bg-gradient-to-br from-white/[0.06] to-transparent blur-sm" />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

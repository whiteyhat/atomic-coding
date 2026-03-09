"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, Star, Globe, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { slideInRight, scaleIn, staggerContainer } from "./dashboard-animations";

interface DashboardStatsProps {
  totalAtoms: number;
  gamesCount: number;
  publishedCount: number;
  buildsCount: number;
  isLoading?: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const from = prevValue.current;
    prevValue.current = value;

    const controls = animate(from, value, {
      duration: 1.2,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate(v) {
        node.textContent = Math.round(v).toLocaleString();
      },
    });

    return () => controls.stop();
  }, [value]);

  return (
    <p ref={ref} className="text-lg font-bold text-white">
      {value.toLocaleString()}
    </p>
  );
}

function AnimatedDonut({
  totalAtoms,
  isLoading,
}: {
  totalAtoms: number;
  isLoading?: boolean;
}) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = useMotionValue(circumference);
  const dashOffset = useTransform(progress, (v) => v);

  const donutRef = useRef<HTMLParagraphElement>(null);
  const prevAtoms = useRef(0);

  // Animate fill
  useEffect(() => {
    if (isLoading) return;
    const fillRatio = Math.min(Math.log10(totalAtoms + 1) / 3, 1);
    const target = circumference * (1 - fillRatio);
    const controls = animate(progress, target, {
      duration: 1.5,
      ease: [0.25, 0.46, 0.45, 0.94],
      delay: 0.3,
    });
    return () => controls.stop();
  }, [totalAtoms, isLoading, progress, circumference]);

  // Animate center number
  useEffect(() => {
    const node = donutRef.current;
    if (!node || isLoading) return;

    const from = prevAtoms.current;
    prevAtoms.current = totalAtoms;

    const controls = animate(from, totalAtoms, {
      duration: 1.5,
      ease: [0.25, 0.46, 0.45, 0.94],
      delay: 0.3,
      onUpdate(v) {
        node.textContent = Math.round(v).toLocaleString();
      },
    });

    return () => controls.stop();
  }, [totalAtoms, isLoading]);

  return (
    <div className="relative mx-auto flex size-48 items-center justify-center">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <defs>
          <linearGradient id="donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <circle
          cx="100" cy="100" r={radius} fill="none"
          stroke="rgba(255,255,255,0.08)" strokeWidth="14"
        />
        <motion.circle
          cx="100" cy="100" r={radius} fill="none"
          stroke="url(#donut-gradient)" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {isLoading ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Atom Count
            </p>
            <div className="mt-1.5 h-8 w-20 animate-pulse rounded-md bg-white/10" />
            <p className="mt-1 text-xs text-white/50">Total Atoms</p>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
              Atom Count
            </p>
            <p
              ref={donutRef}
              className="mt-1 text-3xl font-bold text-white"
            >
              {totalAtoms.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-white/50">Total Atoms</p>
          </>
        )}
      </div>
    </div>
  );
}

export function DashboardStats({
  totalAtoms,
  gamesCount,
  publishedCount,
  buildsCount,
  isLoading,
}: DashboardStatsProps) {
  const statCircles = [
    {
      icon: Star,
      value: gamesCount,
      label: "GAMES",
      bgColor: "bg-rose-500/20",
      iconColor: "text-rose-400",
      ringColor: "ring-rose-500/30",
    },
    {
      icon: Globe,
      value: publishedCount,
      label: "PUBLISHED",
      bgColor: "bg-blue-500/20",
      iconColor: "text-blue-400",
      ringColor: "ring-blue-500/30",
    },
    {
      icon: Zap,
      value: buildsCount,
      label: "BUILDS",
      bgColor: "bg-purple-500/20",
      iconColor: "text-purple-400",
      ringColor: "ring-purple-500/30",
    },
  ];

  return (
    <motion.aside variants={slideInRight} initial="hidden" animate="visible" className="space-y-4">
      <div className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-6 shadow-[0_18px_60px_rgba(24,8,10,0.22)]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
          <motion.button
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/8 hover:text-white/70"
            whileHover={{ x: 3 }}
          >
            <ArrowRight className="size-4" />
          </motion.button>
        </div>

        <div className="mt-6">
          <AnimatedDonut totalAtoms={totalAtoms} isLoading={isLoading} />
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mt-6 grid grid-cols-3 gap-3"
        >
          {statCircles.map(({ icon: Icon, value, label, bgColor, iconColor, ringColor }) => (
            <motion.div key={label} variants={scaleIn} className="flex flex-col items-center gap-2">
              <div
                className={`flex size-11 items-center justify-center rounded-full ${bgColor} ring-1 ${ringColor}`}
              >
                <Icon className={`size-4 ${iconColor}`} />
              </div>
              <div className="text-center">
                {isLoading ? (
                  <div className="mx-auto h-5 w-8 animate-pulse rounded bg-white/10" />
                ) : (
                  <AnimatedNumber value={value} />
                )}
                <p className="text-[9px] uppercase tracking-[0.15em] text-white/40">{label}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.aside>
  );
}

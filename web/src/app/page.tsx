"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Snowflake,
  Maximize,
  Zap,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

/* ─── Loading Screen ─── */
function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const words = ["Design", "Create", "Inspire"];
  const startTime = useRef(0);
  const rafRef = useRef<number>(0);
  const done = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((i) => (i + 1) % 3);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    startTime.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const pct = Math.min(elapsed / 2700, 1);
      setProgress(Math.floor(pct * 100));
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else if (!done.current) {
        done.current = true;
        setTimeout(onComplete, 400);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col justify-between"
      style={{ background: "#0a0a0a" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Top-left label */}
      <motion.div
        className="p-6 md:p-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <span className="text-xs md:text-sm uppercase tracking-[0.3em] text-[#888]">
          Portfolio
        </span>
      </motion.div>

      {/* Center rotating words */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={wordIndex}
            className="font-loader italic text-4xl md:text-6xl lg:text-7xl text-[#f5f5f5]/80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {words[wordIndex]}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Bottom section */}
      <div className="p-6 md:p-10">
        {/* Counter — bottom right */}
        <div className="flex justify-end mb-4">
          <span className="font-loader text-6xl md:text-8xl lg:text-9xl tabular-nums text-[#f5f5f5]">
            {String(progress).padStart(3, "0")}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-[3px] bg-[#1f1f1f]/50 overflow-hidden">
          <motion.div
            className="h-full origin-left"
            style={{
              background: "linear-gradient(to right, #89AACC, #4E85BF)",
              boxShadow: "0 0 8px rgba(137,170,204,0.35)",
              transform: `scaleX(${progress / 100})`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Hero Section ─── */
function HeroSection({ onNavigate }: { onNavigate: () => void }) {
  const specs = [
    { label: "Stack", value: "React + Node + SQL" },
    { label: "Logic", value: "V8 - Runtime Logic" },
    { label: "Uptime", value: "99.9% High-Avail" },
    { label: "Scale", value: "Responsive Modern Layout" },
  ];

  return (
    <motion.div
      className="relative min-h-screen bg-black text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Background Video — Desktop */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="hidden md:block absolute inset-0 w-full h-full object-cover"
        src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4"
      />
      {/* Background Video — Mobile */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="md:hidden w-full h-[60vh] object-cover"
        src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4"
      />

      {/* Overlays */}
      <div className="hidden md:block absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_70%,rgba(0,0,0,0.7)_100%)]" />
      <div className="md:hidden absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />

      {/* Content wrapper */}
      <div className="relative md:absolute md:inset-0 container mx-auto px-6 md:px-12 min-h-screen md:h-screen flex flex-col justify-between py-6 md:py-10">
        {/* Top-right nav */}
        <div className="flex justify-end items-center gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-xs font-mono-jb tracking-widest">1/01</span>
            <div className="relative w-6 md:w-[24px] h-[1px] bg-white/20">
              <div className="absolute left-0 top-0 h-full w-1/4 bg-white" />
            </div>
          </div>
          <button
            onClick={onNavigate}
            className="text-[10px] font-mono-jb tracking-[0.2em] uppercase hover:text-white/80 transition-colors"
          >
            Next Project
          </button>
        </div>

        {/* Main grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 items-end md:items-center">
          {/* Left column */}
          <div className="md:col-span-9 flex flex-col gap-6">
            <motion.h1
              className="font-display text-[40px] sm:text-[56px] md:text-[72px] leading-[1] md:leading-[0.9] font-medium tracking-tighter uppercase max-w-xl"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              Viktor-O //{" "}
              <br />
              Modern Architect
            </motion.h1>

            <motion.p
              className="text-sm text-white font-light max-w-md leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Developed with high-end skills and a pixel-perfect frame for those
              who don&apos;t just browse the web—they build it. Code your
              dreams....
            </motion.p>

            <motion.div
              className="flex gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              {[Snowflake, Maximize, Zap].map((Icon, i) => (
                <button
                  key={i}
                  className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:border-white/60 transition-colors"
                >
                  <Icon size={16} className="text-white/80" />
                </button>
              ))}
            </motion.div>
          </div>

          {/* Right column — specs */}
          <motion.div
            className="md:col-span-3 md:pt-32"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            <p className="text-[10px] font-mono-jb tracking-[0.3em] uppercase font-display mb-4">
              Technical Specs
            </p>
            <div className="space-y-3">
              {specs.map((s) => (
                <div
                  key={s.label}
                  className="flex justify-between items-end border-b border-white/20 pb-2"
                >
                  <span className="text-xs text-white/60">{s.label}</span>
                  <span className="text-xs">{s.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom section */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 md:gap-8 pb-4">
          {/* Product Card */}
          <motion.div
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-4 md:p-6 flex gap-4 items-start hover:bg-white/10 transition-colors cursor-pointer max-w-md"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0 rounded-2xl overflow-hidden">
              <img
                src="https://picsum.photos/200"
                alt="Project thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-[#F27D26]/40 to-transparent" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-mono-jb tracking-widest uppercase font-display">
                VK-01: React Engine
              </p>
              <p className="text-[11px] text-white/60">
                High-performance builds and a clean stack for speed and
                stability.
              </p>
              <button
                onClick={onNavigate}
                className="self-start text-[10px] font-mono-jb uppercase tracking-widest border border-white/20 rounded-lg px-4 py-2 hover:bg-white hover:text-black transition-colors mt-1"
              >
                View Project
              </button>
            </div>
          </motion.div>

          {/* Feature Tags */}
          <motion.div
            className="bg-white/10 backdrop-blur-md rounded-2xl md:rounded-full p-2 border border-white/5 flex flex-wrap md:flex-nowrap gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
          >
            <span className="bg-white text-black text-[10px] font-mono-jb tracking-widest px-4 py-2 rounded-full">
              TS/JS
            </span>
            {["V1", "Full-Stack", "Cloud-Ready"].map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono-jb tracking-widest px-3 py-2 rounded-full border border-white/20"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Project Page ─── */
function ProjectPage({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      className="relative min-h-screen bg-black text-white overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Background Video — Desktop */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="hidden md:block absolute inset-0 w-full h-full object-cover"
        src="https://videos.pexels.com/video-files/857032/857032-hd_1920_1080_25fps.mp4"
      />
      {/* Background Video — Mobile */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="md:hidden w-full h-[50vh] object-cover"
        src="https://videos.pexels.com/video-files/857032/857032-hd_1920_1080_25fps.mp4"
      />

      {/* Overlays */}
      <div className="hidden md:block absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)]" />
      <div className="md:hidden absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black" />

      {/* Content */}
      <div className="relative md:absolute md:inset-0 container mx-auto px-6 md:px-12 min-h-screen md:h-screen flex flex-col justify-between py-6 md:py-10">
        {/* Top-right nav */}
        <div className="flex justify-end">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-mono-jb tracking-[0.2em] uppercase hover:text-white/80 transition-colors"
          >
            <ArrowLeft size={14} />
            Back Home
          </button>
        </div>

        {/* Main grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-8 pt-12 md:pt-48 items-start">
          {/* Left column */}
          <div className="md:col-span-8">
            <motion.h1
              className="font-display text-[60px] sm:text-[80px] md:text-[120px] leading-[0.85] font-medium tracking-tighter uppercase"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              PROJECTY
              <br />
              ENGINE
            </motion.h1>
            <motion.p
              className="text-xl md:text-3xl font-light text-white/90 mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              We create high-performance
              <br />
              digital architectures.
            </motion.p>
          </div>

          {/* Right column */}
          <motion.div
            className="md:col-span-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            <p className="text-sm md:text-base text-white/70 font-light leading-relaxed">
              A cutting-edge digital engine built for scalable, modern web
              applications. Combining performant React architecture with
              server-side rendering and real-time data pipelines to deliver
              experiences that feel instant and look stunning.
            </p>
            <button className="mt-4 text-[10px] font-mono-jb tracking-[0.3em] uppercase border-b border-white/40 pb-1 hover:border-white transition-colors">
              Read More
            </button>
          </motion.div>
        </div>

        {/* Bottom section */}
        <div className="grid grid-cols-1 md:grid-cols-12 items-end gap-8 pb-4">
          {/* Left — info blocks */}
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <motion.div
              className="border-t border-white/20 pt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <p className="text-xs font-mono-jb tracking-[0.2em] uppercase">
                01 // CORE ARCHITECTURE
              </p>
              <p className="text-[11px] text-white/50 uppercase tracking-widest mt-1">
                Check office in Los Angeles
              </p>
            </motion.div>
            <motion.div
              className="border-t border-white/20 pt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}
            >
              <p className="text-xs font-mono-jb tracking-[0.2em] uppercase">
                02 // PERFORMANCE METRICS
              </p>
              <p className="text-[11px] text-white/50 uppercase tracking-widest mt-1">
                Our effective SEO Positioning
              </p>
            </motion.div>
          </div>

          {/* Right — arrows + meta */}
          <motion.div
            className="md:col-span-4 flex flex-col items-start md:items-end gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="flex gap-3">
              <button className="p-2 border border-white/20 rounded-full hover:bg-white hover:text-black transition-colors">
                <ArrowLeft size={16} />
              </button>
              <button className="p-2 border border-white/20 rounded-full hover:bg-white hover:text-black transition-colors">
                <ArrowRight size={16} />
              </button>
            </div>
            <p className="text-[10px] font-mono-jb tracking-[0.2em] text-white/40">
              25 March 2026 | Project
            </p>
            <p className="text-sm md:text-base font-light italic text-white/80">
              Photographs that attract attention.
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main App ─── */
export default function LandingPage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"hero" | "project">("hero");

  const handleLoadingComplete = useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <div className="bg-black min-h-screen text-white">
      <AnimatePresence mode="wait">
        {loading && (
          <LoadingScreen
            key="loader"
            onComplete={handleLoadingComplete}
          />
        )}
      </AnimatePresence>

      {!loading && (
        <AnimatePresence mode="wait">
          {view === "hero" ? (
            <HeroSection
              key="hero"
              onNavigate={() => setView("project")}
            />
          ) : (
            <ProjectPage
              key="project"
              onBack={() => setView("hero")}
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

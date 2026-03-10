"use client";

import { lazy, Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Bot,
  Crown,
  Gamepad2,
  Gauge,
  Globe,
  Orbit,
  Play,
  Radar,
  Rocket,
  Shield,
  Sparkles,
  Swords,
  TowerControl,
  Waypoints,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fadeInUp,
  scaleIn,
  slideInRight,
  staggerContainer,
} from "@/components/dashboard/dashboard-animations";
import { useAppAuth } from "@/lib/privy-provider";

const LazyArchitectureView = lazy(
  () =>
    import("@/components/architecture-view").then((m) => ({
      default: m.ArchitectureView,
    }))
);

const VIDEO_URL =
  "https://www.youtube-nocookie.com/embed/YQxreN2E3yw?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&loop=1&playlist=YQxreN2E3yw";

const heroSignals = [
  {
    label: "Idea to playable",
    value: "< 60 sec",
    detail: "Your first game builds in under a minute",
    tone: "text-emerald-200",
  },
  {
    label: "AI crew",
    value: "Always on",
    detail: "Multiple AI agents working on your game at once",
    tone: "text-cyan-200",
  },
  {
    label: "Launch-ready",
    value: "Built in",
    detail: "Go from draft to shareable link instantly",
    tone: "text-amber-200",
  },
];

const engineCards: Array<{
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
}> = [
  {
    eyebrow: "Describe It",
    title: "One sentence is all it takes. Buu builds the rest.",
    description:
      "Tell Buu what kind of game you want — the genre, the vibe, the mechanics. It handles the code, the assets, and the logic so you can focus on your vision.",
    icon: Sparkles,
    accent:
      "from-rose-500/28 via-orange-400/16 to-transparent",
  },
  {
    eyebrow: "Watch It Build",
    title: "See your game come together in real time.",
    description:
      "Watch AI agents generate art, write code, and assemble your game live. Tweak anything on the fly — no waiting, no context switching.",
    icon: Zap,
    accent:
      "from-cyan-500/24 via-sky-400/14 to-transparent",
  },
  {
    eyebrow: "Share It",
    title: "One click to publish. Send the link. Let people play.",
    description:
      "Publishing is built right into the creation flow. When your game is ready, share it with the world — no extra tools, no export headaches.",
    icon: Rocket,
    accent:
      "from-violet-500/26 via-fuchsia-400/14 to-transparent",
  },
];

const swarmStages: Array<{
  step: string;
  title: string;
  description: string;
  status: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    step: "01",
    title: "Describe your dream game",
    description:
      "Pick the genre, set the mood, choose the mechanics. You bring the creative vision — Buu handles everything else.",
    status: "You decide",
    icon: Crown,
    tone: "text-rose-200",
  },
  {
    step: "02",
    title: "AI agents get to work",
    description:
      "Multiple specialized AI agents collaborate — one on art, one on code, one on game logic — building your game in parallel.",
    status: "Creating",
    icon: Bot,
    tone: "text-cyan-200",
  },
  {
    step: "03",
    title: "Play, test, and refine",
    description:
      "Your game is playable in seconds. See it live, make changes with natural language, and watch it update instantly.",
    status: "Playable",
    icon: Radar,
    tone: "text-emerald-200",
  },
  {
    step: "04",
    title: "Publish and share with the world",
    description:
      "Hit publish and get a shareable link. Your game is live on the web, ready for players — with built-in tools to grow your audience.",
    status: "Live",
    icon: Globe,
    tone: "text-amber-200",
  },
];

const launchLanes = [
  {
    eyebrow: "Instant Publishing",
    title: "Your game goes live the moment you're ready.",
    points: [
      "Get a shareable link to your game with one click — no deployment steps, no hosting setup.",
      "Track who's playing, update your game anytime, and keep full control over your creation.",
      "Publishing is part of the flow, not an afterthought. Build it, play it, ship it.",
    ],
  },
  {
    eyebrow: "Your Studio",
    title: "Everything you need to run your games, in one place.",
    points: [
      "See all your games, their status, player activity, and updates from a single dashboard.",
      "Manage your creations like a real game studio — professional tools, zero complexity.",
      "Spend less time switching between tools and more time making great games.",
    ],
  },
  {
    eyebrow: "Monetization",
    title: "Built-in tools to turn your games into a business.",
    points: [
      "Monetization features are woven into the platform so you can earn from day one.",
      "Set up your game's economy alongside your game — no separate tools or integrations needed.",
      "One platform for creating, publishing, and growing your game business.",
    ],
  },
];

const telemetryCards = [
  {
    label: "Your game",
    value: "Building",
    detail: "Code, art, and logic generating live",
    tone: "text-emerald-200",
  },
  {
    label: "AI agents",
    value: "Active",
    detail: "Working together on your creation",
    tone: "text-cyan-200",
  },
  {
    label: "Launch",
    value: "Ready",
    detail: "One click to publish and share",
    tone: "text-amber-200",
  },
];

const cozyMarketingScene = {
  src: "/marketing/landing/stardew-inspired-farm-world.png",
  label: "Cozy & Casual",
  title: "From peaceful farm sims to high-octane action.",
  description:
    "Build any kind of game you can imagine. Relaxing life sims, intense shooters, puzzle adventures — Buu adapts to your creative vision.",
  alt: "Original cozy farming-adventure world with crops, cabins, and warm village light.",
  aspectClassName: "aspect-[4/3]",
};

function LivePreviewVideo() {
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);

  return (
    <motion.div
      className="absolute inset-0"
      onViewportEnter={() => setShouldLoadVideo(true)}
      viewport={{ once: true, amount: 0.35 }}
    >
      {shouldLoadVideo ? (
        <iframe
          title="Buu AI Game Maker live preview"
          src={VIDEO_URL}
          className="absolute inset-0 size-full border-0"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.18),transparent_38%),linear-gradient(145deg,#210d11_0%,#090305_100%)]" />
      )}
    </motion.div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-300/80">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-[2.4rem]">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-7 text-white/62 md:text-base">
        {description}
      </p>
    </div>
  );
}

function MarketingSceneCard({
  src,
  alt,
  label,
  title,
  description,
  aspectClassName,
}: {
  src: string;
  alt: string;
  label: string;
  title: string;
  description: string;
  aspectClassName: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      className="group overflow-hidden rounded-[1.9rem] border border-white/8 bg-black/22 shadow-[0_22px_70px_rgba(10,2,4,0.24)]"
    >
      <div className={`relative ${aspectClassName} overflow-hidden bg-[#16070b]`}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 40vw"
          className="object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,1,2,0.04)_0%,rgba(4,1,2,0.16)_38%,rgba(4,1,2,0.78)_100%)]" />
        <div className="absolute left-4 top-4 rounded-full border border-white/12 bg-black/38 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/78">
          {label}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
          <p className="text-lg font-semibold text-white md:text-xl">{title}</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/62">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function HomeLandingPage() {
  const router = useRouter();
  const { authenticated, ready } = useAppAuth();

  const [swarmOpen, setSwarmOpen] = useState(false);

  const primaryLabel = !ready
    ? "Syncing Access"
    : authenticated
      ? "Open Command Center"
      : "Enter Command Center";

  function handleOpenDashboard() {
    const destination = authenticated
      ? "/dashboard"
      : `/login?redirect=${encodeURIComponent("/dashboard")}`;

    router.push(destination);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#45131d_0%,#18070c_42%,#070204_100%)] text-stone-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(244,63,94,0.2),transparent_28%),radial-gradient(circle_at_84%_10%,rgba(45,212,191,0.14),transparent_20%),radial-gradient(circle_at_82%_72%,rgba(168,85,247,0.14),transparent_24%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.8), transparent 85%)",
        }}
      />
      <motion.div
        className="pointer-events-none absolute left-[8%] top-28 size-44 rounded-full bg-rose-500/20 blur-[110px]"
        animate={{ opacity: [0.45, 0.9, 0.45], y: [0, 24, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute right-[10%] top-44 size-52 rounded-full bg-cyan-400/10 blur-[124px]"
        animate={{ opacity: [0.25, 0.7, 0.25], y: [0, -18, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-16 left-1/2 size-56 -translate-x-1/2 rounded-full bg-violet-500/10 blur-[144px]"
        animate={{ opacity: [0.18, 0.45, 0.18], scale: [0.92, 1.06, 0.92] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0f0508]/72 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 shadow-[0_16px_40px_rgba(0,0,0,0.26)]">
              <Gamepad2 className="size-5 text-white/80" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                Buu AI Game Maker
              </p>
              <p className="text-base font-semibold tracking-tight text-white md:text-lg">
                Build fast. Launch louder.
              </p>
            </div>
          </Link>

          <a
            href="https://build.avax.network/build-games"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-200 transition hover:bg-red-500/20 sm:inline-flex"
          >
            <span className="size-1.5 rounded-full bg-red-400 animate-pulse" />
            Avalanche Build Games Submission
            <ArrowRight className="size-3" />
          </a>

          <nav className="hidden items-center gap-6 text-sm text-white/55 lg:flex">
            <a href="#engine" className="transition hover:text-white">
              How It Works
            </a>
            <a href="#swarm" className="transition hover:text-white">
              AI Agents
            </a>
            <a href="#launch-stack" className="transition hover:text-white">
              Publish & Grow
            </a>
          </nav>

          <Button
            size="lg"
            onClick={handleOpenDashboard}
            disabled={!ready}
            className="rounded-full bg-rose-500 px-6 text-white shadow-[0_18px_44px_rgba(244,63,94,0.28)] hover:bg-rose-400"
          >
            {primaryLabel}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </header>

      <main className="relative">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-[1480px] px-4 pb-16 pt-8 md:px-6 md:pb-20 md:pt-10"
        >
          <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
            <motion.div
              variants={fadeInUp}
              className="overflow-hidden rounded-[2.4rem] border border-white/8 bg-[#2a0b12]/90 p-6 shadow-[0_28px_100px_rgba(14,3,6,0.34)] md:p-8 lg:p-10"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.24em] text-white/72">
                <TowerControl className="size-3.5 text-rose-300" />
                AI Game War Room
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-tight text-white sm:text-5xl lg:text-[4.8rem]">
                Ship a playable game before the hype cools off.
              </h1>

              <p className="mt-6 max-w-2xl text-sm leading-7 text-white/66 md:text-lg">
                Describe the game you want to make. Buu's AI agents build it
                in real time — code, art, logic, everything. Play it instantly,
                tweak it with words, and publish it for the world with one click.
              </p>

              <a
                href="https://build.avax.network/build-games"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-red-500/20 bg-red-500/8 px-4 py-2 text-xs font-medium text-red-200/90 transition hover:bg-red-500/16"
              >
                <span className="size-2 rounded-full bg-red-400 animate-pulse" />
                Built for the Avalanche Build Games Hackathon
                <span className="text-white/40">|</span>
                <span className="font-semibold text-red-100 underline underline-offset-2">
                  Learn more
                </span>
                <ArrowRight className="size-3" />
              </a>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={handleOpenDashboard}
                  disabled={!ready}
                  className="rounded-full bg-rose-500 px-7 text-white shadow-[0_18px_44px_rgba(244,63,94,0.3)] hover:bg-rose-400"
                >
                  {primaryLabel}
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="rounded-full border border-white/10 bg-white/[0.04] px-7 text-white hover:bg-white/[0.08] hover:text-white"
                >
                  <a href="#engine">
                    See How It Works
                    <Play className="size-4" />
                  </a>
                </Button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {heroSignals.map((signal) => (
                  <motion.div
                    key={signal.label}
                    variants={scaleIn}
                    className="rounded-[1.5rem] border border-white/8 bg-black/22 p-4"
                  >
                    <p className="text-[11px] uppercase tracking-[0.26em] text-white/40">
                      {signal.label}
                    </p>
                    <p className={`mt-2 text-xl font-semibold ${signal.tone}`}>
                      {signal.value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-white/52">
                      {signal.detail}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-rose-400/18 bg-rose-500/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Swords className="size-4 text-rose-300" />
                    Lightning fast
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    Go from idea to playable game in under a minute.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-cyan-400/18 bg-cyan-500/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Orbit className="size-4 text-cyan-200" />
                    All-in-one
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    Create, build, test, and publish — all from one dashboard.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-violet-400/18 bg-violet-500/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Shield className="size-4 text-violet-200" />
                    Studio quality
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    Professional-grade games that look and feel polished.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={slideInRight}
              className="relative overflow-hidden rounded-[2.4rem] border border-white/8 bg-[#2a0b12]/88 p-4 shadow-[0_28px_100px_rgba(14,3,6,0.34)] md:p-5 xl:sticky xl:top-6"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.2),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0))]" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#12060a]/92">
                <div
                  className="absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />

                <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 pb-4 pt-5 md:px-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                      Live Preview
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      See your game come to life in real time.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
                      AI building
                    </div>
                    <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-200">
                      Game ready
                    </div>
                  </div>
                </div>

                <div className="relative aspect-[4/3] overflow-hidden border-b border-white/10 bg-[#080204] md:aspect-[16/10]">
                  <LivePreviewVideo />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,2,4,0.08)_0%,rgba(7,2,4,0.12)_36%,rgba(7,2,4,0.75)_100%)]" />
                  <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] bg-[length:100%_4px] opacity-20" />

                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <div className="rounded-full border border-white/12 bg-black/38 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-white/72">
                      Live gameplay
                    </div>
                    <div className="rounded-full border border-rose-400/24 bg-rose-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-rose-200">
                      Made with Buu
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-[1.4rem] border border-white/10 bg-black/38 p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          <Gauge className="size-4 text-rose-300" />
                          Real-time creation
                        </div>
                        <p className="mt-2 text-sm leading-6 text-white/60">
                          Watch your game take shape as AI agents generate every
                          element — visible from the very first prompt.
                        </p>
                      </div>

                      <div className="rounded-[1.4rem] border border-white/10 bg-black/38 p-4 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-medium text-white">
                          <Waypoints className="size-4 text-cyan-200" />
                          Ready to share
                        </div>
                        <p className="mt-2 text-sm leading-6 text-white/60">
                          Publish your game, share the link, and start building
                          your player community — all from the same place.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 md:px-5 md:py-5">
                  {telemetryCards.map((card) => (
                    <div
                      key={card.label}
                      className="rounded-[1.25rem] border border-white/8 bg-black/24 px-4 py-3"
                    >
                      <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">
                        {card.label}
                      </p>
                      <p className={`mt-2 text-lg font-semibold ${card.tone}`}>
                        {card.value}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-white/52">
                        {card.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <motion.div
                className="absolute -right-3 top-16 hidden w-56 rounded-[1.5rem] border border-white/10 bg-[#17080d]/92 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.34)] xl:block"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Activity className="size-4 text-emerald-200" />
                  Live status
                </div>
                <p className="mt-3 text-xs leading-6 text-white/58">
                  Every game you create has a live dashboard — track progress,
                  player activity, and updates at a glance.
                </p>
              </motion.div>
            </motion.div>
          </section>

          <motion.section
            id="engine"
            variants={fadeInUp}
            className="mt-8 rounded-[2.4rem] border border-white/8 bg-[#2a0b12]/86 p-6 shadow-[0_28px_100px_rgba(14,3,6,0.28)] md:mt-10 md:p-8"
          >
            <SectionHeader
              eyebrow="How It Works"
              title="From your imagination to a playable game. Effortlessly."
              description="Buu AI Game Maker handles the entire game creation pipeline — you describe what you want, AI agents build it, and you publish it to the world. No coding required."
            />

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {engineCards.map(({ eyebrow, title, description, icon: Icon, accent }) => (
                <motion.div
                  key={title}
                  variants={fadeInUp}
                  className="relative overflow-hidden rounded-[1.9rem] border border-white/8 bg-black/22 p-5"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${accent}`} />
                  <div className="relative">
                    <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                      <Icon className="size-5 text-white/80" />
                    </div>
                    <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                      {eyebrow}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-white/58">
                      {description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <MarketingSceneCard {...cozyMarketingScene} />

              <motion.div
                variants={fadeInUp}
                className="rounded-[1.9rem] border border-white/8 bg-black/22 p-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                  Any Genre
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Whatever game lives in your head, Buu can build it.
                </h3>
                <p className="mt-4 text-sm leading-7 text-white/60">
                  RPGs, platformers, puzzle games, farming sims, shooters, tower
                  defense — Buu understands dozens of game genres and adapts its
                  AI agents to match your creative direction perfectly.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Endless variety</p>
                    <p className="mt-2 text-xs leading-6 text-white/55">
                      Cozy life sims, intense action games, retro arcade classics
                      — your imagination is the only limit.
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-4">
                    <p className="text-sm font-medium text-white">Smart adaptation</p>
                    <p className="mt-2 text-xs leading-6 text-white/55">
                      Buu adjusts art style, game mechanics, and UI to match the
                      genre you choose — automatically.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>

          <motion.section
            id="swarm"
            variants={fadeInUp}
            className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]"
          >
            <div className="rounded-[2.4rem] border border-white/8 bg-[#2a0b12]/86 p-6 shadow-[0_28px_100px_rgba(14,3,6,0.28)] md:p-8">
              <SectionHeader
                eyebrow="AI Agents"
                title="A team of AI specialists, working together on your game."
                description="Buu doesn't use one AI — it deploys a team. Art agents, code agents, and logic agents collaborate in real time to bring your game to life faster than you thought possible."
              />

              <div className="mt-8 grid gap-3">
                <div className="rounded-[1.5rem] border border-rose-400/16 bg-rose-500/8 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Radar className="size-4 text-rose-300" />
                    Full visibility
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    See exactly what every AI agent is doing on your game —
                    every asset, every line of code, every decision in real time.
                  </p>
                  <div className="relative mt-3 inline-flex">
                    {/* Particle orbit container — centered on the button */}
                    <div className="pointer-events-none absolute inset-0">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className="absolute left-1/2 top-1/2"
                          style={{
                            animation: `swarm-orbit ${5 + i * 0.8}s linear infinite`,
                            animationDelay: `${i * -1.1}s`,
                          }}
                        >
                          <span
                            className="block rounded-full"
                            style={{
                              width: `${2 + (i % 3)}px`,
                              height: `${2 + (i % 3)}px`,
                              background:
                                i % 2 === 0
                                  ? "rgba(251,113,133,0.7)"
                                  : "rgba(244,63,94,0.5)",
                              boxShadow:
                                i % 2 === 0
                                  ? "0 0 6px 2px rgba(251,113,133,0.35)"
                                  : "0 0 4px 1px rgba(244,63,94,0.25)",
                              animation: `swarm-twinkle ${1.4 + i * 0.3}s ease-in-out infinite alternate`,
                            }}
                          />
                        </span>
                      ))}

                      {/* Soft glow rings */}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="absolute inset-[-6px] rounded-full bg-rose-500/8 animate-[swarm-pulse_3s_ease-in-out_infinite]" />
                        <span className="absolute inset-[-12px] rounded-full bg-rose-500/4 animate-[swarm-pulse_3s_ease-in-out_infinite_0.5s]" />
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative z-10 rounded-full border border-rose-400/30 bg-rose-500/14 px-5 text-xs uppercase tracking-[0.18em] text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.15)] hover:bg-rose-500/24 hover:text-rose-100 hover:shadow-[0_0_30px_rgba(244,63,94,0.25)]"
                      onClick={() => setSwarmOpen(true)}
                    >
                      <span className="absolute inset-0 rounded-full animate-[swarm-ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite] border border-rose-400/30" />
                      <span className="absolute inset-0 rounded-full animate-[swarm-ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite_0.8s] border border-rose-400/20" />
                      <span className="relative inline-flex items-center gap-2">
                        <Waypoints className="size-3.5" />
                        Inspect Swarm Architecture
                      </span>
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/8 bg-black/22 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
                      The goal
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      Describe, play, publish — done
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-white/8 bg-black/22 p-4">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
                      Your experience
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      Fast, beautiful, ready to share
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[2.4rem] border border-white/8 bg-[#2a0b12]/86 p-6 shadow-[0_28px_100px_rgba(14,3,6,0.28)] md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
                    Your Journey
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    Four steps to your first game
                  </p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/65">
                  Try it free
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {swarmStages.map(({ step, title, description, status, icon: Icon, tone }) => (
                  <motion.div
                    key={step}
                    variants={fadeInUp}
                    className="grid gap-4 rounded-[1.75rem] border border-white/8 bg-black/22 p-4 md:grid-cols-[84px_minmax(0,1fr)_auto] md:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                        <Icon className={`size-4 ${tone}`} />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/38">
                          Stage
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white">{step}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-lg font-semibold text-white">{title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/58">
                        {description}
                      </p>
                    </div>

                    <div className="justify-self-start md:justify-self-end">
                      <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/70">
                        {status}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section
            id="launch-stack"
            variants={fadeInUp}
            className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]"
          >
            <div className="rounded-[2.4rem] border border-white/8 bg-[#2a0b12]/86 p-6 shadow-[0_28px_100px_rgba(14,3,6,0.28)] md:p-8">
              <SectionHeader
                eyebrow="Publish & Grow"
                title="Your game deserves an audience. Buu gets it there."
                description="Publishing isn't an afterthought — it's built into every step. Go from private creation to public game with a single click, and use built-in tools to grow your player base."
              />

              <div className="mt-8 space-y-4">
                {launchLanes.map((lane) => (
                  <div
                    key={lane.title}
                    className="rounded-[1.7rem] border border-white/8 bg-black/22 p-5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                      {lane.eyebrow}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
                      {lane.title}
                    </h3>
                    <div className="mt-4 space-y-3">
                      {lane.points.map((point) => (
                        <div key={point} className="flex items-start gap-3">
                          <div className="mt-2 size-2 rounded-full bg-rose-400" />
                          <p className="text-sm leading-7 text-white/60">{point}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[2.4rem] border border-white/8 bg-[#2a0b12]/86 p-6 shadow-[0_28px_100px_rgba(14,3,6,0.28)] md:p-8">
              <div className="grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-[1.9rem] border border-white/8 bg-black/22 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/40">
                    Your Dashboard
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-4">
                      <p className="text-sm font-medium text-white">All your games, one view</p>
                      <p className="mt-2 text-xs leading-6 text-white/55">
                        See every game you've created, what stage it's in, and
                        jump back into editing or publishing instantly.
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-4">
                      <p className="text-sm font-medium text-white">Player insights</p>
                      <p className="mt-2 text-xs leading-6 text-white/55">
                        Track who's playing your games, how they're engaging,
                        and use those insights to make your next game even better.
                      </p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-4">
                      <p className="text-sm font-medium text-white">Pro-grade tools</p>
                      <p className="mt-2 text-xs leading-6 text-white/55">
                        A real creator dashboard built for serious game makers —
                        not a toy, but a platform you can build a business on.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.9rem] border border-cyan-400/16 bg-cyan-500/8 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/75">
                      Free to start
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      Start building in seconds. No credit card needed.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-white/58">
                      Sign up, describe your game, and watch it come to life.
                      Your personal game studio is one click away.
                    </p>
                  </div>

                  <div className="rounded-[1.9rem] border border-amber-400/18 bg-amber-500/8 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/75">
                      Built for growth
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      A platform that grows with your ambition.
                    </p>
                    <p className="mt-3 text-sm leading-7 text-white/58">
                      Start with one game. Build a catalog. Grow an audience.
                      Buu gives you the tools to go from hobbyist to game studio
                      — all on one platform.
                    </p>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleOpenDashboard}
                    disabled={!ready}
                    className="w-full rounded-full bg-rose-500 text-white shadow-[0_18px_44px_rgba(244,63,94,0.28)] hover:bg-rose-400"
                  >
                    {primaryLabel}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            variants={fadeInUp}
            className="mt-8 overflow-hidden rounded-[2.6rem] border border-white/8 bg-[#2a0b12]/88 p-6 shadow-[0_28px_100px_rgba(14,3,6,0.3)] md:p-8 lg:p-10"
          >
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(244,63,94,0.18),rgba(34,211,238,0.08)_55%,rgba(168,85,247,0.14))] p-6 md:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0))]" />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/55">
                    Final Call
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-[2.8rem]">
                    Your next game is one conversation away.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/68 md:text-base">
                    Join thousands of creators who are building, publishing,
                    and sharing original games — no coding, no design skills,
                    no limits.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-white/58">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">
                      No code needed
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">
                      AI-powered creation
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2">
                      Instant publishing
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    onClick={handleOpenDashboard}
                    disabled={!ready}
                    className="rounded-full bg-white px-7 text-black hover:bg-white/90"
                  >
                    {primaryLabel}
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="ghost"
                    className="rounded-full border border-white/10 bg-black/16 px-7 text-white hover:bg-black/24 hover:text-white"
                  >
                    <a href="#swarm">Meet the AI Agents</a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>
        </motion.div>
      </main>

      <footer className="border-t border-white/6 bg-[#0a0305]">
        <div className="mx-auto flex max-w-[1480px] flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-white/40 sm:flex-row md:px-6">
          <p>&copy; {new Date().getFullYear()} Atomic Coding. All rights reserved.</p>
          <a
            href="https://x.com/carlosroldanx"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 transition hover:text-white/70"
          >
            Happily vibecoded by{" "}
            <span className="font-medium text-white/60 underline underline-offset-2 transition group-hover:text-white">
              Carlos Roldan
            </span>
            <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-1" />
          </a>
        </div>
      </footer>

      <Dialog open={swarmOpen} onOpenChange={setSwarmOpen}>
        <DialogContent
          showCloseButton
          className="flex h-[90vh] max-h-[90vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden p-0 sm:max-w-[95vw]"
        >
          <DialogHeader className="shrink-0 px-6 pt-5 pb-0">
            <DialogTitle className="text-white">
              System Topology — AI Swarm
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 px-4 pb-4">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-white/40">
                  Loading architecture view...
                </div>
              }
            >
              {swarmOpen && (
                <LazyArchitectureView
                  lastEditedGame={null}
                  className="h-full min-h-0 rounded-2xl"
                />
              )}
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

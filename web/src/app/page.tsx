"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useAppAuth } from "@/lib/privy-provider";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260221_085953_8463b46e-ba85-4bb7-912a-1feaf346e970.mp4";

/* ─── Seamless-loop background video ─── */
function LoopingVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    function tick() {
      const v = videoRef.current;
      if (v && v.duration) {
        const remaining = v.duration - v.currentTime;
        if (remaining <= 1.5) {
          // fade out: 1.5s → 0.3s remaining maps to 1 → 0
          const t = Math.max((remaining - 0.3) / 1.2, 0);
          setOpacity(t);
        } else if (v.currentTime <= 1) {
          // fade in over first 1s
          setOpacity(v.currentTime);
        } else {
          setOpacity(1);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
      style={{ opacity }}
      src={VIDEO_URL}
    />
  );
}

/* ─── Navbar ─── */
function Navbar({ onGetStarted }: { onGetStarted: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        {/* Brand */}
        <span className="text-lg font-semibold text-white">
          Game Maker<span className="text-[hsl(73,98%,57%)]">.</span>
        </span>

        {/* Desktop CTA */}
        <button onClick={onGetStarted} className="hidden md:block text-sm bg-[hsl(73,98%,57%)] text-[hsl(240,67%,1%)] rounded-full px-5 py-2 font-medium hover:brightness-110 transition">
          Get Started
        </button>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </nav>
  );
}

/* ─── Landing Page ─── */
export default function LandingPage() {
  const { login, authenticated } = useAppAuth();
  const router = useRouter();

  useEffect(() => {
    if (authenticated) {
      router.replace("/games");
    }
  }, [authenticated, router]);

  const handleGetStarted = useCallback(() => {
    if (authenticated) {
      router.push("/games");
    } else {
      login();
    }
  }, [authenticated, login, router]);

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{ background: "hsl(240, 67%, 1%)", color: "hsl(0, 0%, 100%)" }}
    >
      {/* Background video — full opacity, no overlay */}
      <LoopingVideo />

      {/* Navbar */}
      <Navbar onGetStarted={handleGetStarted} />

      {/* Hero content — bottom-aligned, centered */}
      <div className="relative z-10 h-full flex items-end justify-center pb-[100px] px-6">
        <div className="flex flex-col items-center text-center max-w-[603px]">
          {/* Badge */}
          <span className="inline-block border border-[hsla(0,0%,100%,0.1)] rounded-full px-4 py-1.5 text-sm text-[hsla(0,0%,82%,0.8)] mb-6">
            Introducing Smart Game Maker
          </span>

          {/* Heading */}
          <h1 className="text-[36px] sm:text-[48px] md:text-[62px] font-medium leading-[1.1] mb-5">
            Turn your big idea into a stunning game
          </h1>

          {/* Paragraph */}
          <p className="text-[hsla(0,0%,82%,0.8)] max-w-[520px] mb-8 leading-relaxed">
            Game Maker lets anyone who can imagine games make them reality. Just describe your idea, our +5 specialized AI agents build the entire pipeline.
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button onClick={handleGetStarted} className="flex items-center gap-2 bg-[hsl(73,98%,57%)] text-[hsl(240,67%,1%)] rounded-full px-6 py-3 text-lg font-medium hover:brightness-110 transition">
              <ArrowUpRight size={20} />
              Get Started Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

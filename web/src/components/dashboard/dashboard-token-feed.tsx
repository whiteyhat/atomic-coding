"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { TokenActivityItem } from "@/lib/types";
import { fadeInUp, staggerContainer, cardHover } from "./dashboard-animations";

function TokenRing({ color, size = 40 }: { color: string; size?: number }) {
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * 0.3 }}
        transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}

function TokenCard({ item }: { item: TokenActivityItem }) {
  const isPositive = item.changePercent >= 0;

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={cardHover}
      className="flex w-[260px] shrink-0 snap-start items-center gap-3 rounded-[1.5rem] border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm transition hover:border-white/15 hover:bg-white/[0.06] md:w-[280px]"
    >
      <div className="shrink-0">
        <TokenRing color={item.tokenColor} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-white">
            {item.tokenSymbol}{" "}
            <span className="font-normal capitalize text-white/60">{item.action}</span>
          </p>
          <span className={`shrink-0 text-sm font-semibold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
            {isPositive ? "+" : ""}{item.changePercent}%
          </span>
        </div>
        <p className="mt-0.5 text-xs text-white/40">
          {item.timeAgo} &bull; {item.detail}
        </p>
      </div>
    </motion.div>
  );
}

export function DashboardTokenFeed({ items }: { items: TokenActivityItem[] }) {
  return (
    <motion.section variants={fadeInUp} initial="hidden" animate="visible">
      <div className="mb-4 flex items-center justify-between px-1">
        <h2 className="text-xl font-semibold text-white">Token Activity Feed</h2>
        <Link href="/dashboard" className="text-sm text-white/50 transition hover:text-white/80">
          Open Dashboard
        </Link>
      </div>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-4 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((item) => (
          <TokenCard key={item.id} item={item} />
        ))}
      </motion.div>
    </motion.section>
  );
}

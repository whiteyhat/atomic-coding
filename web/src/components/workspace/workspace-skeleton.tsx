/** Lightweight skeleton components for the workspace — no client deps, pure Tailwind. */

function PulseBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-white/10 ${className ?? ""}`} />;
}

function PulseBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/10 ${className ?? ""}`} />;
}

/* ── Nav rail skeleton (left 68px column) ─────────────────────────── */
function NavRailSkeleton() {
  return (
    <div className="sticky top-3 hidden h-[calc(100vh-1.5rem)] w-[68px] shrink-0 flex-col items-center rounded-[2rem] border border-white/8 bg-[#2a1014] p-2.5 lg:flex">
      {/* Logo */}
      <div className="flex items-center justify-center py-1.5">
        <PulseBlock className="size-10 rounded-2xl" />
      </div>
      {/* Nav items */}
      <div className="mt-4 flex flex-1 flex-col items-center gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <PulseBlock key={i} className="size-10 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/* ── Header skeleton ──────────────────────────────────────────────── */
function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 h-12 px-4 rounded-t-[1.25rem] border-b border-white/8 shrink-0 bg-[#2a1014]/80">
      <PulseBlock className="size-8 rounded-xl" />
      <PulseBar className="h-4 w-32" />
      <PulseBar className="hidden sm:block h-6 w-24 rounded-full" />
      <div className="ml-auto flex items-center gap-2">
        <PulseBlock className="h-8 w-20 rounded-xl" />
        <PulseBlock className="size-8 rounded-xl" />
      </div>
    </div>
  );
}

/* ── Sidebar panel skeleton (chat list / tab content area) ────────── */
export function SidebarPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4 h-full">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <PulseBlock className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <PulseBar className={`h-3 ${i % 2 === 0 ? "w-3/4" : "w-1/2"}`} />
            <PulseBar className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Sidebar skeleton (tab bar + panel) ───────────────────────────── */
function SidebarSkeleton() {
  return (
    <div
      className="shrink-0 flex flex-col rounded-bl-[1.25rem] border-r border-white/8 bg-[#2a1014]/95 overflow-hidden"
      style={{ width: 400 }}
    >
      {/* Tab bar */}
      <div className="flex items-stretch h-11 border-b border-white/[0.06] px-1.5 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 my-1.5">
            <PulseBlock className="size-3.5 rounded" />
            <PulseBar className="h-3 w-10" />
          </div>
        ))}
      </div>
      {/* Panel content */}
      <div className="flex-1 min-h-0">
        <SidebarPanelSkeleton />
      </div>
    </div>
  );
}

/* ── Game panel skeleton ──────────────────────────────────────────── */
export function GamePanelSkeleton() {
  return (
    <div className="flex-1 min-w-0 relative rounded-br-[1.25rem] bg-black/60 overflow-hidden flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 animate-spin rounded-full border-2 border-rose-400/30 border-t-rose-400" />
        <span className="text-xs text-white/40">Loading game...</span>
      </div>
    </div>
  );
}

/* ── Full workspace skeleton (used by loading.tsx) ────────────────── */
export function WorkspaceSkeleton() {
  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_50%,#0f0508_100%)] text-stone-50 px-3 py-3">
      {/* Nav rail */}
      <NavRailSkeleton />

      {/* Main workspace area */}
      <div className="flex flex-col flex-1 min-w-0 lg:ml-3 rounded-[1.25rem] border border-white/8 bg-[#2a1014]/50 overflow-hidden shadow-[0_18px_60px_rgba(24,8,10,0.25)]">
        <HeaderSkeleton />
        <div className="flex flex-1 min-h-0">
          <SidebarSkeleton />
          <div className="w-1 shrink-0 bg-transparent" />
          <GamePanelSkeleton />
        </div>
      </div>
    </div>
  );
}

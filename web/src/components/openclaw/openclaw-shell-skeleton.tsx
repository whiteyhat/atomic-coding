function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/8 ${className}`} />;
}

export function OpenClawShellSkeleton() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#4c1a1f_0%,#210b10_48%,#0d0407_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">
      <div className="mx-auto flex max-w-[1680px] gap-5">
        <div className="hidden w-[82px] shrink-0 rounded-[2.3rem] border border-white/8 bg-[#2a1014]/80 lg:block" />

        <main className="min-w-0 flex-1 space-y-5">
          <SkeletonBlock className="h-16 w-full border border-white/8 bg-[#311519]/70" />

          <section className="rounded-[1.9rem] border border-white/8 bg-[linear-gradient(135deg,rgba(65,20,28,0.96),rgba(24,8,12,0.94))] p-6 shadow-[0_26px_110px_rgba(24,8,10,0.34)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <SkeletonBlock className="h-7 w-28" />
                <SkeletonBlock className="h-10 w-full max-w-[620px]" />
                <SkeletonBlock className="h-5 w-full max-w-[700px]" />
                <SkeletonBlock className="h-5 w-[78%]" />
              </div>
              <div className="flex gap-2">
                <SkeletonBlock className="h-11 w-24" />
                <SkeletonBlock className="h-11 w-44" />
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
            <section className="rounded-[1.75rem] border border-white/8 bg-[#251015]/95 p-5 shadow-[0_24px_80px_rgba(24,8,10,0.22)]">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="mt-3 h-8 w-40" />
              <SkeletonBlock className="mt-2 h-4 w-full" />
              <div className="mt-5 space-y-3">
                <SkeletonBlock className="h-[72px] w-full" />
                <SkeletonBlock className="h-[72px] w-full" />
                <SkeletonBlock className="h-[72px] w-full" />
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/8 bg-[#251015]/95 p-5 shadow-[0_24px_80px_rgba(24,8,10,0.22)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="mt-3 h-8 w-64 max-w-full" />
                  <SkeletonBlock className="mt-2 h-4 w-full" />
                </div>
                <SkeletonBlock className="h-9 w-28" />
              </div>

              <div className="mt-5 flex gap-2">
                <SkeletonBlock className="h-8 w-28" />
                <SkeletonBlock className="h-8 w-28" />
                <SkeletonBlock className="h-8 w-28" />
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <SkeletonBlock className="h-[116px] w-full" />
                <SkeletonBlock className="h-[116px] w-full" />
              </div>

              <div className="mt-4">
                <SkeletonBlock className="h-4 w-48" />
                <SkeletonBlock className="mt-3 h-[220px] w-full rounded-[1.25rem]" />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

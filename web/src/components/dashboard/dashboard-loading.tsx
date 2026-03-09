"use client";

export function DashboardLoading({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_50%,#0f0508_100%)] p-4 text-stone-50 md:p-6">
      <div className="mx-auto max-w-[1540px]">
        <div className="mb-4 rounded-[1.75rem] border border-white/8 bg-[#311519]/95 px-6 py-5">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-white/45">Dashboard</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{description}</p>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1540px] gap-4">
        <div className="hidden w-[82px] rounded-[2.3rem] bg-[#2a1014]/80 lg:block" />
        <div className="flex-1 space-y-4">
          <div className="h-16 rounded-[2rem] bg-[#311519]/60" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <div className="h-[340px] animate-pulse rounded-[2rem] bg-[#311519]/60" />
              <div className="flex gap-4">
                <div className="h-[280px] w-[300px] shrink-0 animate-pulse rounded-[1.75rem] bg-[#311519]/60" />
                <div className="h-[280px] w-[300px] shrink-0 animate-pulse rounded-[1.75rem] bg-[#311519]/60" />
              </div>
            </div>
            <div className="h-[500px] animate-pulse rounded-[2rem] bg-[#311519]/60" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardStatusCard({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_50%,#0f0508_100%)] px-6">
      <div className="max-w-xl rounded-[2rem] border border-white/10 bg-[#311519]/95 p-8 text-center text-white shadow-[0_24px_90px_rgba(24,8,10,0.3)]">
        <p className="text-sm uppercase tracking-[0.2em] text-white/45">Dashboard</p>
        <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/60">{description}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

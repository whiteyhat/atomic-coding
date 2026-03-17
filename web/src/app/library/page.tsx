import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const LibraryShell = dynamic(
  () =>
    import("@/components/library/library-shell").then((module) => ({
      default: module.LibraryShell,
    })),
  {
    ssr: process.env.NODE_ENV === "production",
    loading: () => <LibraryPageFallback />,
  },
);

function LibraryPageFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_48%,#0f0508_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">
      <div className="mx-auto flex min-h-[70vh] max-w-[1920px] items-center justify-center rounded-[2rem] border border-white/8 bg-[#311519]/70">
        <div className="flex items-center gap-3 text-sm text-white/55">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading your library...</span>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return <LibraryShell />;
}

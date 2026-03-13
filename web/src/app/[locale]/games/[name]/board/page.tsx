import { setRequestLocale } from "next-intl/server";
import { LeaderboardPanel } from "@/components/leaderboard/leaderboard-panel";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaderboardPageProps {
  params: Promise<{ locale: string; name: string }>;
}

export default async function LeaderboardPage({
  params,
}: LeaderboardPageProps) {
  const { locale, name } = await params;
  setRequestLocale(locale);
  const gameName = decodeURIComponent(name);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 h-12 px-4 border-b">
        <Link href={`/games/${encodeURIComponent(gameName)}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <Trophy className="size-5 text-yellow-500" />
        <h1 className="text-lg font-medium">{gameName} — Leaderboard</h1>
      </header>
      <main className="max-w-lg mx-auto py-8">
        <LeaderboardPanel gameName={gameName} />
      </main>
    </div>
  );
}

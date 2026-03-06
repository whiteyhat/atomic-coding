import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2 } from "lucide-react";
import type { GameWithBuild } from "@/lib/types";

interface GameCardProps {
  game: GameWithBuild;
}

export function GameCard({ game }: GameCardProps) {
  const hasBuild = !!game.active_build_id;

  return (
    <Link href={`/games/${encodeURIComponent(game.name)}`}>
      <Card className="glass-panel shadow-buu-muted hover:border-primary/30 transition-all cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Gamepad2 className="size-5 shrink-0 text-muted-foreground" />
              <CardTitle className="text-base truncate">{game.name}</CardTitle>
            </div>
            <Badge variant={hasBuild ? "default" : "secondary"} className="shrink-0">
              {hasBuild ? "Active" : "No build"}
            </Badge>
          </div>
          {game.description && (
            <CardDescription className="line-clamp-2">
              {game.description}
            </CardDescription>
          )}
          <div className="flex items-center gap-2 mt-2">
            {game.genre && (
              <Badge variant="outline" className="text-xs">
                {game.genre.replace(/-/g, " ")}
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">
              Created {new Date(game.created_at).toLocaleDateString()}
            </p>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

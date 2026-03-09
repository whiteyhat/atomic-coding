"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useGame } from "@/lib/hooks";
import { SUPABASE_URL } from "@/lib/constants";

interface SettingsTabProps {
  gameName: string;
}

export function SettingsTab({ gameName }: SettingsTabProps) {
  const { data: game, isLoading } = useGame(gameName);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="p-3">
        <p className="text-sm text-destructive">Game not found</p>
      </div>
    );
  }

  const bundleUrl = game.active_build_id
    ? `${SUPABASE_URL}/storage/v1/object/public/bundles/${gameName}/latest.js`
    : null;

  return (
    <div className="p-3 space-y-4">
      <div className="space-y-2">
        <Label className="text-xs">Name</Label>
        <Input value={game.name} readOnly className="h-8 text-sm bg-muted/50" />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Description</Label>
        <Input
          value={game.description ?? "No description"}
          readOnly
          className="h-8 text-sm bg-muted/50"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Game ID</Label>
        <Input
          value={game.id}
          readOnly
          className="h-8 text-xs font-mono bg-muted/50"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Created</Label>
        <p className="text-sm text-muted-foreground">
          {new Date(game.created_at).toLocaleString()}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Active Build</Label>
        {game.active_build_id ? (
          <div className="flex items-center gap-2">
            <Badge variant="default">Active</Badge>
            <span className="text-xs text-muted-foreground font-mono truncate">
              {game.active_build_id.slice(0, 8)}
            </span>
          </div>
        ) : (
          <Badge variant="secondary">No build</Badge>
        )}
      </div>

      {bundleUrl && (
        <div className="space-y-2">
          <Label className="text-xs">Bundle URL</Label>
          <Input
            value={bundleUrl}
            readOnly
            className="h-8 text-[10px] font-mono bg-muted/50"
          />
        </div>
      )}
    </div>
  );
}

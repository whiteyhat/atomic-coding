"use client";

import { CreateGameDialog } from "./create-game-dialog";
import { UserMenu } from "@/components/auth/user-menu";

export function GamesHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Buu AI Game Maker
        </h1>
        <p className="text-muted-foreground mt-1">
          Build Three.js games with AI agents
        </p>
      </div>
      <div className="flex items-center gap-3">
        <CreateGameDialog />
        <UserMenu />
      </div>
    </div>
  );
}

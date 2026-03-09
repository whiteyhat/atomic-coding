"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { Game } from "@/lib/types";
import { CreateGameWizard } from "./create-game-wizard";

interface CreateGameDialogProps {
  onCreated?: (game: Game) => void;
}

export function CreateGameDialog({ onCreated }: CreateGameDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 size-4" />
        New Game
      </Button>
      <CreateGameWizard open={open} onOpenChange={setOpen} onCreated={onCreated} />
    </>
  );
}

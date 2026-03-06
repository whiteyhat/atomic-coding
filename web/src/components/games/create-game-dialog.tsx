"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createGame } from "@/lib/api";
import { GenreSelector } from "./genre-selector";

interface CreateGameDialogProps {
  onCreated?: () => void;
}

export function CreateGameDialog({ onCreated }: CreateGameDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"genre" | "details">("genre");
  const [genre, setGenre] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function resetForm() {
    setStep("genre");
    setGenre(null);
    setName("");
    setDescription("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !genre) return;

    setLoading(true);
    setError(null);

    try {
      await createGame(
        name.trim(),
        description.trim() || undefined,
        undefined,
        genre
      );
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-2" />
          New Game
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {step === "genre" ? (
          <>
            <DialogHeader>
              <DialogTitle>Choose a genre</DialogTitle>
              <DialogDescription>
                Pick a starting template. Each genre comes with pre-built atoms
                and a Three.js scaffold.
              </DialogDescription>
            </DialogHeader>
            <GenreSelector value={genre} onChange={setGenre} />
            <DialogFooter>
              <Button
                onClick={() => setStep("details")}
                disabled={!genre}
              >
                Next
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Name your game</DialogTitle>
              <DialogDescription>
                Give your game a unique name. You can add a description later.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="game-name">Name</Label>
                <Input
                  id="game-name"
                  placeholder="my-awesome-game"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="game-desc">Description (optional)</Label>
                <Input
                  id="game-desc"
                  placeholder="A 3D platformer with physics"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("genre")}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button type="submit" disabled={loading || !name.trim()}>
                  {loading ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

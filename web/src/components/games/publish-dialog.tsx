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
import { Globe, Loader2 } from "lucide-react";
import { publishGame, unpublishGame } from "@/lib/api";
import { ShareCard } from "./share-card";

interface PublishDialogProps {
  gameName: string;
  isPublished: boolean;
  publicSlug: string | null;
  onPublished?: () => void;
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  triggerSize?: React.ComponentProps<typeof Button>["size"];
  triggerClassName?: string;
  triggerLabel?: string;
}

export function PublishDialog({
  gameName,
  isPublished,
  publicSlug,
  onPublished,
  triggerVariant,
  triggerSize,
  triggerClassName,
  triggerLabel,
}: PublishDialogProps) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(publicSlug ?? gameName.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    if (!slug.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await publishGame(gameName, slug.trim().toLowerCase());
      onPublished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnpublish() {
    setLoading(true);
    setError(null);

    try {
      await unpublishGame(gameName);
      onPublished?.();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unpublish");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant ?? (isPublished ? "outline" : "default")}
          size={triggerSize ?? "sm"}
          className={triggerClassName}
        >
          <Globe className="size-3.5 mr-1.5" />
          {triggerLabel ?? (isPublished ? "Published" : "Publish")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isPublished ? "Manage Publication" : "Publish Game"}
          </DialogTitle>
          <DialogDescription>
            {isPublished
              ? "Your game is live! Share the link or unpublish it."
              : "Make your game playable by anyone with the link."}
          </DialogDescription>
        </DialogHeader>

        {isPublished && publicSlug ? (
          <div className="space-y-4">
            <ShareCard slug={publicSlug} />
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={handleUnpublish}
                disabled={loading}
              >
                {loading && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Unpublish
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pub-slug">Public URL slug</Label>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>/play/</span>
                <Input
                  id="pub-slug"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                  }
                  disabled={loading}
                  className="flex-1"
                  placeholder="my-game"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button onClick={handlePublish} disabled={loading || !slug.trim()}>
                {loading && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                Publish
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

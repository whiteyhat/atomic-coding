"use client";

import { useAssetModels } from "@/lib/use-asset-models";
import type { AssetModel } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Loader2, Check } from "lucide-react";

interface AssetModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: AssetModel[];
  onToggle: (model: AssetModel) => void;
}

export function AssetModelDialog({
  open,
  onOpenChange,
  selected,
  onToggle,
}: AssetModelDialogProps) {
  const {
    filteredItems,
    search,
    setSearch,
    isLoading,
    error,
    hasMore,
    loadMore,
  } = useAssetModels();

  const selectedIds = new Set(selected.map((m) => m._id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-zinc-800/50">
          <DialogTitle className="text-sm">
            3D Model Library
            {selected.length > 0 && (
              <span className="ml-2 text-zinc-500 font-normal">
                {selected.length} selected
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/30">
          <Search className="size-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-300 placeholder:text-zinc-600 outline-none"
          />
        </div>

        {/* Grid */}
        <ScrollArea className="max-h-[60vh]">
          {error && (
            <div className="p-4 text-center text-sm text-red-400">
              {error}
            </div>
          )}

          {!error && filteredItems.length === 0 && !isLoading && (
            <div className="p-8 text-center text-sm text-zinc-500">
              No models found
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
            {filteredItems.map((model) => {
              const isSelected = selectedIds.has(model._id);
              return (
                <button
                  key={model._id}
                  onClick={() => onToggle(model)}
                  className={cn(
                    "group relative flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors",
                    isSelected
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 z-10 size-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="size-3 text-white" />
                    </div>
                  )}
                  <div className="aspect-square w-full overflow-hidden rounded-md bg-zinc-900">
                    {model.image?.url ? (
                      <img
                        src={model.image.url}
                        alt={model.prompt ?? ""}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center text-zinc-700 text-xs">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <p className="text-xs text-zinc-300 line-clamp-2">
                      {model.prompt ?? "Untitled"}
                    </p>
                    {model.style && (
                      <Badge
                        variant="secondary"
                        className="self-start text-[10px] px-1.5 py-0"
                      >
                        {model.style}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={isLoading}
                className="text-xs text-zinc-400"
              >
                {isLoading ? (
                  <Loader2 className="size-3 animate-spin mr-1.5" />
                ) : null}
                {isLoading ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}

          {isLoading && filteredItems.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-zinc-500" />
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

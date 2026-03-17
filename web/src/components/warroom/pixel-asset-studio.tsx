"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Clapperboard,
  ImageIcon,
  Layers3,
  Loader2,
  RefreshCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  getWarRoomAssets,
  patchWarRoomAssetLayout,
  retryWarRoomTask,
} from "@/lib/api";
import {
  applyLayoutPatchLocally,
  buildPixelAssetStudioModel,
  deriveFramesFromDividers,
  normalizeAnimationLayout,
  type PixelStudioFrame,
} from "@/lib/pixel-asset-studio";
import type {
  PixelAnimationLayout,
  WarRoomGeneratedAsset,
} from "@/lib/types";

interface PixelAssetStudioProps {
  gameName: string;
  warRoomId: string;
  refreshToken: string;
}

function FrameThumbnail({
  frame,
  sheetUrl,
  sheetWidth,
  sheetHeight,
  scale = 1,
}: {
  frame: PixelStudioFrame;
  sheetUrl: string | null;
  sheetWidth: number;
  sheetHeight: number;
  scale?: number;
}) {
  if (frame.url) {
    return (
      <img
        src={frame.url}
        alt={`Frame ${frame.index}`}
        className="h-full w-full object-contain"
      />
    );
  }

  if (!sheetUrl) {
    return <div className="h-full w-full bg-white/5" />;
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: frame.width * scale,
        height: frame.height * scale,
      }}
    >
      <img
        src={sheetUrl}
        alt={`Frame ${frame.index}`}
        className="pointer-events-none absolute left-0 top-0 max-w-none"
        style={{
          width: sheetWidth * scale,
          height: sheetHeight * scale,
          transform: `translate(${-frame.x * scale}px, ${-frame.y * scale}px)`,
        }}
      />
    </div>
  );
}

function currentFrameForIndex(
  frames: PixelStudioFrame[],
  index: number,
): PixelStudioFrame | null {
  if (frames.length === 0) return null;
  return frames[index % frames.length] ?? frames[0] ?? null;
}

export function PixelAssetStudio({
  gameName,
  warRoomId,
  refreshToken,
}: PixelAssetStudioProps) {
  const [assets, setAssets] = useState<WarRoomGeneratedAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePackId, setActivePackId] = useState<string | null>(null);
  const [activeAnimation, setActiveAnimation] = useState<string | null>(null);
  const [fps, setFps] = useState(10);
  const [frameCursor, setFrameCursor] = useState(0);
  const [draftLayout, setDraftLayout] = useState<PixelAnimationLayout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    orientation: "vertical" | "horizontal";
    index: number;
  } | null>(null);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await getWarRoomAssets(gameName, warRoomId);
      setAssets(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load Pixel assets");
    } finally {
      setIsLoading(false);
    }
  }, [gameName, warRoomId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets, refreshToken]);

  const studio = useMemo(() => buildPixelAssetStudioModel(assets), [assets]);

  useEffect(() => {
    if (!studio.animationPacks.length) {
      setActivePackId(null);
      return;
    }

    if (!activePackId || !studio.animationPacks.some((pack) => pack.assetId === activePackId)) {
      setActivePackId(studio.animationPacks[0].assetId);
    }
  }, [activePackId, studio.animationPacks]);

  const currentPack = useMemo(
    () => studio.animationPacks.find((pack) => pack.assetId === activePackId) ?? studio.animationPacks[0] ?? null,
    [activePackId, studio.animationPacks],
  );

  useEffect(() => {
    if (!currentPack?.animations.length) {
      setActiveAnimation(null);
      return;
    }

    if (!activeAnimation || !currentPack.animations.some((entry) => entry.animation === activeAnimation)) {
      setActiveAnimation(currentPack.animations[0].animation);
    }
  }, [activeAnimation, currentPack]);

  const currentAnimationData = useMemo(
    () =>
      currentPack?.animations.find((entry) => entry.animation === activeAnimation) ??
      currentPack?.animations[0] ??
      null,
    [activeAnimation, currentPack],
  );

  useEffect(() => {
    if (!currentAnimationData) {
      setDraftLayout(null);
      return;
    }
    setDraftLayout(normalizeAnimationLayout(currentAnimationData));
  }, [currentAnimationData]);

  useEffect(() => {
    if (!currentAnimationData?.frames.length) {
      setFrameCursor(0);
      return;
    }
    const interval = window.setInterval(() => {
      setFrameCursor((value) => (value + 1) % currentAnimationData.frames.length);
    }, Math.max(40, Math.round(1000 / Math.max(1, fps))));
    return () => window.clearInterval(interval);
  }, [currentAnimationData, fps]);

  const previewFrames = useMemo(() => {
    if (!currentAnimationData || !draftLayout) return [];
    return deriveFramesFromDividers({
      width: currentAnimationData.width,
      height: currentAnimationData.height,
      cols: draftLayout.cols,
      rows: draftLayout.rows,
      verticalDividers: draftLayout.vertical_dividers,
      horizontalDividers: draftLayout.horizontal_dividers,
      previousFrames: currentAnimationData.frames,
    });
  }, [currentAnimationData, draftLayout]);

  useEffect(() => {
    if (!draftLayout || !currentAnimationData) return;
    setFrameCursor((value) =>
      previewFrames.length > 0 ? value % previewFrames.length : Math.min(value, currentAnimationData.frames.length - 1),
    );
  }, [currentAnimationData, draftLayout, previewFrames.length]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      const element = editorRef.current;
      const layout = draftLayout;
      if (!dragState || !element || !layout) return;

      const rect = element.getBoundingClientRect();
      if (dragState.orientation === "vertical") {
        const next = [...layout.vertical_dividers];
        const raw = ((event.clientX - rect.left) / rect.width) * 100;
        const prevLimit = dragState.index === 0 ? 5 : next[dragState.index - 1] + 3;
        const nextLimit = dragState.index === next.length - 1 ? 95 : next[dragState.index + 1] - 3;
        next[dragState.index] = Math.max(prevLimit, Math.min(nextLimit, raw));
        const frames = currentAnimationData
          ? deriveFramesFromDividers({
              width: currentAnimationData.width,
              height: currentAnimationData.height,
              cols: layout.cols,
              rows: layout.rows,
              verticalDividers: next,
              horizontalDividers: layout.horizontal_dividers,
              previousFrames: currentAnimationData.frames,
            }).map(({ url: _url, ...frame }) => frame)
          : layout.frames;
        setDraftLayout((current) =>
          current
            ? {
                ...current,
                vertical_dividers: next,
                frames,
              }
            : current,
        );
        return;
      }

      const next = [...layout.horizontal_dividers];
      const raw = ((event.clientY - rect.top) / rect.height) * 100;
      const prevLimit = dragState.index === 0 ? 5 : next[dragState.index - 1] + 3;
      const nextLimit = dragState.index === next.length - 1 ? 95 : next[dragState.index + 1] - 3;
      next[dragState.index] = Math.max(prevLimit, Math.min(nextLimit, raw));
      const frames = currentAnimationData
        ? deriveFramesFromDividers({
            width: currentAnimationData.width,
            height: currentAnimationData.height,
            cols: layout.cols,
            rows: layout.rows,
            verticalDividers: layout.vertical_dividers,
            horizontalDividers: next,
            previousFrames: currentAnimationData.frames,
          }).map(({ url: _url, ...frame }) => frame)
        : layout.frames;
      setDraftLayout((current) =>
        current
          ? {
              ...current,
              horizontal_dividers: next,
              frames,
            }
          : current,
      );
    }

    function handlePointerUp() {
      dragStateRef.current = null;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [currentAnimationData, draftLayout]);

  const activePreviewFrame = useMemo(
    () => currentFrameForIndex(previewFrames.length ? previewFrames : currentAnimationData?.frames ?? [], frameCursor),
    [currentAnimationData?.frames, frameCursor, previewFrames],
  );

  const handleSaveLayout = useCallback(async () => {
    if (!currentPack || !currentAnimationData || !draftLayout) return;

    const finalFrames = previewFrames.map(({ url: _url, ...frame }) => frame);
    setIsSaving(true);
    try {
      const updated = await patchWarRoomAssetLayout(
        gameName,
        warRoomId,
        currentPack.assetId,
        {
          animation: currentAnimationData.animation,
          cols: draftLayout.cols,
          rows: draftLayout.rows,
          vertical_dividers: draftLayout.vertical_dividers,
          horizontal_dividers: draftLayout.horizontal_dividers,
          frames: finalFrames,
        },
      );
      setAssets((current) =>
        current.map((asset) =>
          asset.id === updated.id
            ? applyLayoutPatchLocally({
                asset: updated,
                animation: currentAnimationData.animation,
                layout: {
                  ...draftLayout,
                  frames: finalFrames,
                },
              })
            : asset,
        ),
      );
      await loadAssets();
      toast.success(`Saved ${currentAnimationData.animation} layout`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save layout");
    } finally {
      setIsSaving(false);
    }
  }, [
    currentAnimationData,
    currentPack,
    draftLayout,
    gameName,
    loadAssets,
    previewFrames,
    warRoomId,
  ]);

  const handleRegenerate = useCallback(async () => {
    setIsRetrying(true);
    try {
      await retryWarRoomTask(gameName, warRoomId, 8);
      toast.success("Task 8 queued for regeneration");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to queue Task 8 retry");
    } finally {
      setIsRetrying(false);
    }
  }, [gameName, warRoomId]);

  const hasContent =
    studio.animationPacks.length > 0 ||
    studio.backgroundSets.length > 0 ||
    studio.uiAssets.length > 0 ||
    studio.auxiliaryAssets.length > 0;

  const backgroundSet =
    currentPack
      ? studio.backgroundSets.find((entry) => entry.stableAssetId === currentPack.stableAssetId) ??
        studio.backgroundSets[0] ??
        null
      : studio.backgroundSets[0] ?? null;

  return (
    <div className="rounded-[1.7rem] border border-white/8 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="size-4 text-emerald-300" />
            Pixel Asset Studio
          </div>
          <p className="mt-1 text-[11px] text-white/40">
            Canonical Task 7 and Task 8 assets, frame editor, animation preview, and parallax sandbox.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {studio.manifestAsset?.public_url && (
            <a
              href={studio.manifestAsset.public_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              pixel-manifest.json
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
            disabled={isRetrying}
            onClick={() => void handleRegenerate()}
          >
            {isRetrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Regenerate Task 8
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center justify-center rounded-[1.3rem] border border-white/8 bg-white/[0.03] py-10 text-white/45">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="mt-4 rounded-[1.3rem] border border-rose-300/18 bg-rose-500/[0.08] px-4 py-4 text-sm text-rose-100/82">
          {loadError}
        </div>
      ) : !hasContent ? (
        <div className="mt-4 rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
          Pixel assets will appear here after Tasks 7 and 8 finish.
        </div>
      ) : (
        <Tabs defaultValue="overview" className="mt-4">
          <TabsList variant="line" className="rounded-full border border-white/10 bg-white/[0.03] p-1">
            <TabsTrigger value="overview" className="rounded-full px-3 text-xs text-white/70 data-[state=active]:bg-white/[0.08]">
              Overview
            </TabsTrigger>
            <TabsTrigger value="editor" className="rounded-full px-3 text-xs text-white/70 data-[state=active]:bg-white/[0.08]">
              Layout Editor
            </TabsTrigger>
            <TabsTrigger value="sandbox" className="rounded-full px-3 text-xs text-white/70 data-[state=active]:bg-white/[0.08]">
              Sandbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {studio.animationPacks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/38">
                  <Clapperboard className="size-3.5" />
                  Animation Packs
                </div>
                <div className="grid gap-3 @[980px]:grid-cols-2">
                  {studio.animationPacks.map((pack) => (
                    <div key={pack.assetId} className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{pack.stableAssetId}</p>
                          <p className="mt-1 text-sm leading-6 text-white/60">{pack.characterPrompt}</p>
                        </div>
                        <Badge variant="outline" className="rounded-full border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-100">
                          {pack.referenceMode ?? "prompt_only"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 grid-cols-[104px_minmax(0,1fr)]">
                        <div className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/30">
                          {pack.characterSeedUrl ? (
                            <img
                              src={pack.characterSeedUrl}
                              alt={`${pack.stableAssetId} concept`}
                              className="aspect-square h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex aspect-square items-center justify-center text-white/25">
                              <ImageIcon className="size-5" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {pack.animations.map((animation) => (
                              <Badge key={animation.animation} variant="outline" className="rounded-full border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/65">
                                {animation.animation}
                              </Badge>
                            ))}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            {pack.animations.map((animation) => {
                              const frame = animation.frames[0];
                              return (
                                <div key={animation.animation} className="rounded-[0.95rem] border border-white/8 bg-black/20 p-2">
                                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[0.8rem] bg-white/[0.03]">
                                    {frame ? (
                                      <FrameThumbnail
                                        frame={frame}
                                        sheetUrl={animation.processedSheetUrl}
                                        sheetWidth={animation.width}
                                        sheetHeight={animation.height}
                                        scale={60 / Math.max(frame.width, 1)}
                                      />
                                    ) : null}
                                  </div>
                                  <p className="mt-2 truncate text-[10px] uppercase tracking-[0.18em] text-white/45">
                                    {animation.animation}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(studio.uiAssets.length > 0 || studio.auxiliaryAssets.length > 0) && (
              <div className="grid gap-4 @[980px]:grid-cols-2">
                {studio.uiAssets.length > 0 && (
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/38">
                      <Boxes className="size-3.5" />
                      Task 7 UI Assets
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {studio.uiAssets.map((asset) => (
                        <div key={asset.id} className="rounded-[0.95rem] border border-white/8 bg-black/20 p-2">
                          <div className="overflow-hidden rounded-[0.8rem] border border-white/6 bg-white/[0.03]">
                            {asset.public_url ? (
                              <img src={asset.public_url} alt={asset.stable_asset_id} className="aspect-square h-full w-full object-cover" />
                            ) : (
                              <div className="flex aspect-square items-center justify-center text-white/25">
                                <ImageIcon className="size-4" />
                              </div>
                            )}
                          </div>
                          <p className="mt-2 truncate text-[10px] uppercase tracking-[0.18em] text-white/45">
                            {asset.stable_asset_id}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {studio.auxiliaryAssets.length > 0 && (
                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/38">
                      <Layers3 className="size-3.5" />
                      Task 8 Supporting Assets
                    </div>
                    <ScrollArea className="mt-3 h-[240px] pr-3">
                      <div className="space-y-2">
                        {studio.auxiliaryAssets.map((asset) => (
                          <div key={asset.id} className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3">
                            <div className="h-12 w-12 overflow-hidden rounded-[0.9rem] border border-white/8 bg-white/[0.03]">
                              {asset.public_url ? (
                                <img src={asset.public_url} alt={asset.stable_asset_id} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white/85">{asset.stable_asset_id}</p>
                              <p className="truncate text-[11px] uppercase tracking-[0.18em] text-white/40">
                                {asset.asset_kind} · {asset.variant || "default"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="editor" className="mt-4 space-y-4">
            {currentPack && currentAnimationData && draftLayout ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {studio.animationPacks.map((pack) => (
                    <button
                      key={pack.assetId}
                      type="button"
                      onClick={() => setActivePackId(pack.assetId)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors",
                        pack.assetId === currentPack.assetId
                          ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                          : "border-white/10 bg-black/20 text-white/55 hover:bg-white/[0.06] hover:text-white/75",
                      )}
                    >
                      {pack.stableAssetId}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {currentPack.animations.map((animation) => (
                      <button
                        key={animation.animation}
                        type="button"
                        onClick={() => setActiveAnimation(animation.animation)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors",
                          animation.animation === currentAnimationData.animation
                            ? "border-sky-300/25 bg-sky-500/10 text-sky-100"
                            : "border-white/10 bg-black/20 text-white/55 hover:bg-white/[0.06] hover:text-white/75",
                        )}
                      >
                        {animation.animation}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25"
                    disabled={isSaving}
                    onClick={() => void handleSaveLayout()}
                  >
                    {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save Layout
                  </Button>
                </div>

                <div className="grid gap-4 @[980px]:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
                  <div className="rounded-[1.3rem] border border-white/10 bg-black/30 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{currentPack.stableAssetId}</p>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                          {currentAnimationData.animation} sheet
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                        {draftLayout.cols} x {draftLayout.rows}
                      </Badge>
                    </div>

                    <div
                      ref={editorRef}
                      className="relative overflow-hidden rounded-[1.1rem] border border-white/10 bg-[#05070a]"
                      style={{ aspectRatio: `${Math.max(currentAnimationData.width, 1)} / ${Math.max(currentAnimationData.height, 1)}` }}
                    >
                      {currentAnimationData.processedSheetUrl ? (
                        <img
                          src={currentAnimationData.processedSheetUrl}
                          alt={`${currentPack.stableAssetId} ${currentAnimationData.animation}`}
                          className="h-full w-full object-contain"
                        />
                      ) : null}

                      {draftLayout.vertical_dividers.map((divider, index) => (
                        <button
                          key={`v-${index}`}
                          type="button"
                          onPointerDown={() => {
                            dragStateRef.current = { orientation: "vertical", index };
                          }}
                          className="absolute top-0 h-full w-3 -translate-x-1/2 cursor-col-resize bg-transparent"
                          style={{ left: `${divider}%` }}
                        >
                          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sky-300/80" />
                        </button>
                      ))}
                      {draftLayout.horizontal_dividers.map((divider, index) => (
                        <button
                          key={`h-${index}`}
                          type="button"
                          onPointerDown={() => {
                            dragStateRef.current = { orientation: "horizontal", index };
                          }}
                          className="absolute left-0 w-full h-3 -translate-y-1/2 cursor-row-resize bg-transparent"
                          style={{ top: `${divider}%` }}
                        >
                          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-emerald-300/80" />
                        </button>
                      ))}
                      {previewFrames.map((frame) => (
                        <div
                          key={frame.index}
                          className="pointer-events-none absolute border border-white/10"
                          style={{
                            left: `${(frame.x / currentAnimationData.width) * 100}%`,
                            top: `${(frame.y / currentAnimationData.height) * 100}%`,
                            width: `${(frame.width / currentAnimationData.width) * 100}%`,
                            height: `${(frame.height / currentAnimationData.height) * 100}%`,
                          }}
                        >
                          <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/60">
                            {frame.index}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Frames</p>
                    <ScrollArea className="mt-3 h-[360px] pr-3">
                      <div className="grid grid-cols-2 gap-3">
                        {previewFrames.map((frame) => (
                          <button
                            key={frame.index}
                            type="button"
                            onClick={() => setFrameCursor(frame.index)}
                            className={cn(
                              "rounded-[1rem] border p-2 text-left transition-colors",
                              activePreviewFrame?.index === frame.index
                                ? "border-emerald-300/20 bg-emerald-500/[0.08]"
                                : "border-white/8 bg-black/20 hover:bg-white/[0.04]",
                            )}
                          >
                            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[0.8rem] border border-white/8 bg-white/[0.03]">
                              <FrameThumbnail
                                frame={frame}
                                sheetUrl={currentAnimationData.processedSheetUrl}
                                sheetWidth={currentAnimationData.width}
                                sheetHeight={currentAnimationData.height}
                                scale={84 / Math.max(frame.width, frame.height, 1)}
                              />
                            </div>
                            <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/45">
                              Frame {frame.index}
                            </p>
                            <p className="mt-1 text-[11px] text-white/55">
                              {frame.width} x {frame.height}
                            </p>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                No animation pack available to edit yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="sandbox" className="mt-4 space-y-4">
            {currentAnimationData && activePreviewFrame ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                    FPS {fps}
                  </Badge>
                  <input
                    type="range"
                    min={4}
                    max={24}
                    step={1}
                    value={fps}
                    onChange={(event) => setFps(Number(event.target.value))}
                    className="w-44 accent-emerald-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    {currentPack?.animations.map((animation) => (
                      <button
                        key={animation.animation}
                        type="button"
                        onClick={() => setActiveAnimation(animation.animation)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-colors",
                          animation.animation === currentAnimationData.animation
                            ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50"
                            : "border-white/10 bg-black/20 text-white/55 hover:bg-white/[0.06] hover:text-white/75",
                        )}
                      >
                        {animation.animation}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 @[980px]:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-[radial-gradient(circle_at_top,#12382e_0%,#0b1513_55%,#060708_100%)] p-4">
                    <div className="relative h-[320px] overflow-hidden rounded-[1.1rem] border border-white/8 bg-[#08120f]">
                      {backgroundSet?.layers.map((layer, index) => (
                        <img
                          key={layer.variant}
                          src={layer.url ?? ""}
                          alt={layer.variant}
                          className="absolute inset-0 h-full w-full object-cover opacity-80"
                          style={{
                            transform: `translateX(-${frameCursor * (index + 1) * 6}px) scale(1.08)`,
                          }}
                        />
                      ))}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(4,8,6,0.88))]" />
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                        <div className="rounded-[1rem] border border-white/10 bg-black/30 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                          <FrameThumbnail
                            frame={activePreviewFrame}
                            sheetUrl={currentAnimationData.processedSheetUrl}
                            sheetWidth={currentAnimationData.width}
                            sheetHeight={currentAnimationData.height}
                            scale={140 / Math.max(activePreviewFrame.width, activePreviewFrame.height, 1)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Current Playback</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1rem] border border-white/10 bg-black/25">
                          <FrameThumbnail
                            frame={activePreviewFrame}
                            sheetUrl={currentAnimationData.processedSheetUrl}
                            sheetWidth={currentAnimationData.width}
                            sheetHeight={currentAnimationData.height}
                            scale={72 / Math.max(activePreviewFrame.width, activePreviewFrame.height, 1)}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{currentPack?.stableAssetId}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/45">
                            {currentAnimationData.animation} · frame {activePreviewFrame.index}
                          </p>
                          <p className="mt-2 text-sm text-white/60">
                            {activePreviewFrame.width} x {activePreviewFrame.height}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Parallax Layers</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
                          disabled={isRetrying}
                          onClick={() => void handleRegenerate()}
                        >
                          {isRetrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                          Regenerate
                        </Button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(backgroundSet?.layers ?? []).map((layer) => (
                          <div key={layer.variant} className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3">
                            <div className="h-12 w-12 overflow-hidden rounded-[0.9rem] border border-white/8 bg-white/[0.03]">
                              {layer.url ? <img src={layer.url} alt={layer.variant} className="h-full w-full object-cover" /> : null}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white/82">{layer.variant}</p>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                                {layer.width ?? "?"} x {layer.height ?? "?"}
                              </p>
                            </div>
                          </div>
                        ))}
                        {!(backgroundSet?.layers.length) && (
                          <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3 py-3 text-sm text-white/45">
                            No parallax background layers are attached to this pack yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                No animation preview is available yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

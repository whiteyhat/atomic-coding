"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Check,
  Sparkles,
  Volume2,
  Orbit,
  Map,
  Wind,
  Dice5,
  Waypoints,
  Wifi,
  Box,
  Zap,
  Mountain,
  Swords,
  Target,
  Gamepad2,
  Plus,
  HelpCircle,
  AlertTriangle,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  installExternal,
  uninstallExternal,
  registerCustomExternal,
} from "@/lib/api";
import { useExternals, useRegistry } from "@/lib/hooks";
import type { RegistryEntry } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";

interface ExternalsTabProps {
  gameName: string;
}

/* ── Friendly metadata for no-coders ──────────────────────────────────────── */

export const CARD_META: Record<
  string,
  { icon: LucideIcon; tagline: string; color: string }
> = {
  // 3D
  three_js: {
    icon: Box,
    tagline: "Render stunning 3D worlds, characters & environments",
    color: "from-blue-500/20 to-indigo-500/20",
  },
  cannon_es: {
    icon: Zap,
    tagline: "Add realistic gravity, collisions & bouncing objects",
    color: "from-orange-500/20 to-red-500/20",
  },
  three_orbit_controls: {
    icon: Orbit,
    tagline: "Let players rotate, zoom & explore 3D scenes freely",
    color: "from-cyan-500/20 to-blue-500/20",
  },
  simplex_noise: {
    icon: Mountain,
    tagline: "Generate natural-looking terrain, clouds & textures",
    color: "from-emerald-500/20 to-teal-500/20",
  },
  gsap: {
    icon: Sparkles,
    tagline: "Create smooth, cinematic animations & transitions",
    color: "from-green-500/20 to-emerald-500/20",
  },
  three_gltf_loader: {
    icon: Box,
    tagline: "Import 3D models from Blender, Sketchfab & more",
    color: "from-violet-500/20 to-purple-500/20",
  },
  // 2D
  matter_js: {
    icon: Target,
    tagline: "Add bouncy, tumbling physics to 2D sprites & objects",
    color: "from-amber-500/20 to-orange-500/20",
  },
  planck_js: {
    icon: Gamepad2,
    tagline: "Precise physics for billiards, pinball & platformers",
    color: "from-rose-500/20 to-pink-500/20",
  },
  rot_js: {
    icon: Swords,
    tagline: "Build roguelike dungeons, FOV, pathfinding & turn systems",
    color: "from-purple-500/20 to-fuchsia-500/20",
  },
  seedrandom_js: {
    icon: Dice5,
    tagline: "Make randomness repeatable — same seed, same game every time",
    color: "from-sky-500/20 to-blue-500/20",
  },
  noisejs: {
    icon: Wind,
    tagline: "Create organic patterns, flowing landscapes & visual effects",
    color: "from-teal-500/20 to-cyan-500/20",
  },
  // Shared
  howler_js: {
    icon: Volume2,
    tagline: "Play sound effects, background music & spatial audio",
    color: "from-pink-500/20 to-rose-500/20",
  },
  socket_io_client: {
    icon: Wifi,
    tagline: "Enable real-time multiplayer — connect players together",
    color: "from-indigo-500/20 to-violet-500/20",
  },
  pathfinding_js: {
    icon: Waypoints,
    tagline: "Smart enemy AI — navigate around walls & obstacles",
    color: "from-lime-500/20 to-green-500/20",
  },
  // Asset libraries
  atomic_assets: {
    icon: Map,
    tagline: "Built-in image & sprite asset pipeline for your game",
    color: "from-yellow-500/20 to-amber-500/20",
  },
  buu_assets: {
    icon: Box,
    tagline: "Ready-to-use 3D models, textures & environment assets",
    color: "from-fuchsia-500/20 to-purple-500/20",
  },
  gaussian_splats_3d: {
    icon: Sparkles,
    tagline: "Photorealistic 3D scenes captured from real-world photos",
    color: "from-rose-500/20 to-orange-500/20",
  },
};

export const DEFAULT_META = {
  icon: Box,
  tagline: "Extend your game with additional capabilities",
  color: "from-zinc-500/20 to-slate-500/20",
};

function getMeta(name: string) {
  return CARD_META[name] ?? DEFAULT_META;
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function ExternalsTab({ gameName }: ExternalsTabProps) {
  const {
    data: externals,
    isLoading: extLoading,
    mutate: mutateExternals,
  } = useExternals(gameName);
  const { data: registry, isLoading: regLoading, mutate: mutateRegistry } = useRegistry();
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set());

  const loading = extLoading || regLoading;
  const items = externals ?? [];
  const registryItems = registry ?? [];

  const installedNames = new Set(items.map((e) => e.name));

  // Merge: show all registry items, marking which are installed
  const allLibraries: (RegistryEntry & { installed: boolean })[] =
    registryItems.map((r) => ({
      ...r,
      installed: installedNames.has(r.name),
    }));

  async function handleToggle(entry: RegistryEntry & { installed: boolean }) {
    const name = entry.name;
    if (busyItems.has(name)) return;

    setBusyItems((prev) => new Set([...prev, name]));
    try {
      if (entry.installed) {
        await uninstallExternal(gameName, name);
      } else {
        await installExternal(gameName, name);
      }
      await mutateExternals();
    } catch (err) {
      console.error("Toggle failed:", err);
    } finally {
      setBusyItems((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }

  async function handleCustomRegistered() {
    await mutateRegistry();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const installed = allLibraries.filter((l) => l.installed);
  const available = allLibraries.filter((l) => !l.installed);

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {/* Installed section */}
        {installed.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Active ({installed.length})
              </span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <div className="grid gap-2">
              <AnimatePresence mode="popLayout">
                {installed.map((lib) => (
                  <LibraryCard
                    key={lib.name}
                    lib={lib}
                    busy={busyItems.has(lib.name)}
                    onToggle={() => handleToggle(lib)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Available section */}
        {available.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Available ({available.length})
              </span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <div className="grid gap-2">
              <AnimatePresence mode="popLayout">
                {available.map((lib) => (
                  <LibraryCard
                    key={lib.name}
                    lib={lib}
                    busy={busyItems.has(lib.name)}
                    onToggle={() => handleToggle(lib)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Add custom external */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-white/[0.06]" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Custom
            </span>
            <div className="h-px flex-1 bg-white/[0.06]" />
          </div>
          <AddCustomExternalButton onRegistered={handleCustomRegistered} />
        </div>

        {allLibraries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No libraries available
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

function LibraryCard({
  lib,
  busy,
  onToggle,
}: {
  lib: RegistryEntry & { installed: boolean };
  busy: boolean;
  onToggle: () => void;
}) {
  const meta = getMeta(lib.name);
  const Icon = meta.icon;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onToggle}
      disabled={busy}
      className={`
        group relative w-full text-left rounded-lg border p-3
        transition-all duration-200 cursor-pointer
        ${
          lib.installed
            ? "border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.06]"
            : "border-white/[0.06] bg-transparent hover:border-white/[0.12] hover:bg-white/[0.03]"
        }
        disabled:pointer-events-none disabled:opacity-60
      `}
    >
      {/* Gradient glow on hover */}
      <div
        className={`
          absolute inset-0 rounded-lg bg-gradient-to-br ${meta.color}
          opacity-0 group-hover:opacity-100 transition-opacity duration-300
        `}
      />

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div
          className={`
            shrink-0 mt-0.5 flex items-center justify-center rounded-md
            size-8 bg-gradient-to-br ${meta.color}
            ${lib.installed ? "ring-1 ring-white/[0.12]" : ""}
          `}
        >
          <Icon className="size-4 text-foreground/80" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {lib.display_name}
            </span>
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 h-4 shrink-0 font-mono opacity-60"
            >
              v{lib.version}
            </Badge>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {meta.tagline}
          </p>
        </div>

        {/* Status indicator */}
        <div className="shrink-0 mt-1">
          {busy ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : lib.installed ? (
            <div className="flex items-center justify-center size-5 rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40">
              <Check className="size-3 text-emerald-400" />
            </div>
          ) : (
            <div className="flex items-center justify-center size-5 rounded-full border border-dashed border-white/[0.15] group-hover:border-white/[0.3] transition-colors">
              <span className="size-1.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ── Add Custom External Dialog ───────────────────────────────────────────── */

function AddCustomExternalButton({
  onRegistered,
}: {
  onRegistered: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [cdnUrl, setCdnUrl] = useState("");
  const [globalName, setGlobalName] = useState("");
  const [version, setVersion] = useState("");

  function resetForm() {
    setDisplayName("");
    setCdnUrl("");
    setGlobalName("");
    setVersion("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!displayName.trim() || !cdnUrl.trim() || !globalName.trim()) {
      setError("Name, CDN URL, and Global Name are required.");
      return;
    }

    try {
      new URL(cdnUrl);
    } catch {
      setError("Please enter a valid URL for the CDN link.");
      return;
    }

    setSubmitting(true);
    try {
      await registerCustomExternal({
        display_name: displayName.trim(),
        cdn_url: cdnUrl.trim(),
        global_name: globalName.trim(),
        version: version.trim() || undefined,
      });
      await onRegistered();
      resetForm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register library.",
      );
    } finally {
      setSubmitting(false);
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
        <button
          className="
            group relative w-full rounded-lg border border-dashed
            border-white/[0.08] hover:border-white/[0.16]
            p-3 transition-all duration-200 cursor-pointer
            hover:bg-white/[0.02]
          "
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0 flex items-center justify-center rounded-md size-8 border border-dashed border-white/[0.12] group-hover:border-white/[0.2] transition-colors">
              <Plus className="size-4 text-muted-foreground group-hover:text-foreground/70 transition-colors" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
                Add custom library
              </span>
              <p className="text-[11px] text-muted-foreground/60">
                Import any JavaScript library from a CDN
              </p>
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <HelpCircle className="size-4 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors" />
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="max-w-[260px] p-3 space-y-2"
                >
                  <p className="text-xs font-medium">
                    What is a custom library?
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Libraries are pre-built code packages that add superpowers
                    to your game — like physics, sound, or animations. Custom
                    libraries let you import any JavaScript package from the web.
                  </p>
                  <div className="flex items-start gap-1.5 pt-1">
                    <AlertTriangle className="size-3 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-400/80 leading-relaxed">
                      Only import libraries from sources you trust. External
                      code runs inside your game and can affect how it works.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="size-4" />
            Add custom library
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Import a JavaScript library from a CDN like jsDelivr or unpkg. The
            library will load in your game and the AI will be able to use it
            when building your game code.
          </DialogDescription>
        </DialogHeader>

        {/* Explainer card */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-400" />
            <span className="text-xs font-medium text-amber-300">
              Before you import
            </span>
          </div>
          <ul className="text-[11px] text-muted-foreground space-y-1 pl-5 list-disc">
            <li>
              The library will be loaded via a{" "}
              <code className="text-[10px] bg-white/[0.06] px-1 rounded">
                &lt;script&gt;
              </code>{" "}
              tag in your game
            </li>
            <li>
              It becomes available as a global variable (e.g.{" "}
              <code className="text-[10px] bg-white/[0.06] px-1 rounded">
                window.MyLib
              </code>
              )
            </li>
            <li>
              The AI assistant will know about it but won&apos;t have detailed
              documentation — you may need to describe how to use it
            </li>
            <li>
              Only use trusted sources — external code can affect your
              game&apos;s behavior and security
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="custom-name" className="text-xs">
              Library name
            </Label>
            <Input
              id="custom-name"
              placeholder="e.g. Pixi.js"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground/60">
              A friendly name to identify this library
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custom-cdn" className="text-xs">
              CDN URL
            </Label>
            <Input
              id="custom-cdn"
              placeholder="https://cdn.jsdelivr.net/npm/my-lib/dist/my-lib.min.js"
              value={cdnUrl}
              onChange={(e) => setCdnUrl(e.target.value)}
              className="h-8 text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground/60">
              Direct link to the .js file — usually from jsDelivr or unpkg
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-global" className="text-xs flex items-center gap-1">
                Global name
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/40" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p className="text-[11px]">
                        The variable name the library uses on{" "}
                        <code className="text-[10px]">window</code>. Check the
                        library&apos;s docs — e.g. Three.js uses{" "}
                        <code className="text-[10px]">THREE</code>, GSAP uses{" "}
                        <code className="text-[10px]">gsap</code>.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="custom-global"
                placeholder="e.g. PIXI"
                value={globalName}
                onChange={(e) => setGlobalName(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="custom-version" className="text-xs">
                Version{" "}
                <span className="text-muted-foreground/50">(optional)</span>
              </Label>
              <Input
                id="custom-version"
                placeholder="e.g. 7.3.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2"
            >
              <p className="text-xs text-destructive">{error}</p>
            </motion.div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="size-3.5 mr-1.5" />
                  Add library
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

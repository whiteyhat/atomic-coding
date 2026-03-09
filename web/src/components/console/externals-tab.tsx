"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { installExternal, uninstallExternal } from "@/lib/api";
import { useExternals, useRegistry } from "@/lib/hooks";

interface ExternalsTabProps {
  gameName: string;
}

export function ExternalsTab({ gameName }: ExternalsTabProps) {
  const { data: externals, isLoading: extLoading, mutate: mutateExternals } = useExternals(gameName);
  const { data: registry, isLoading: regLoading } = useRegistry();
  const [selectedRegistry, setSelectedRegistry] = useState("");
  const [installing, setInstalling] = useState(false);

  const loading = extLoading || regLoading;
  const items = externals ?? [];
  const registryItems = registry ?? [];

  const installedNames = new Set(items.map((e) => e.name));
  const available = registryItems.filter((r) => !installedNames.has(r.name));

  async function handleInstall() {
    if (!selectedRegistry) return;
    setInstalling(true);
    try {
      await installExternal(gameName, selectedRegistry);
      setSelectedRegistry("");
      await mutateExternals();
    } catch (err) {
      console.error("Install failed:", err);
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall(name: string) {
    try {
      await uninstallExternal(gameName, name);
      await mutateExternals();
    } catch (err) {
      console.error("Uninstall failed:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Install bar */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Select value={selectedRegistry} onValueChange={setSelectedRegistry}>
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue placeholder="Select library..." />
          </SelectTrigger>
          <SelectContent>
            {available.map((r) => (
              <SelectItem key={r.name} value={r.name}>
                {r.display_name} ({r.version})
              </SelectItem>
            ))}
            {available.length === 0 && (
              <SelectItem value="__none" disabled>
                All libraries installed
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleInstall}
          disabled={!selectedRegistry || installing}
        >
          {installing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Plus className="size-3.5" />
          )}
        </Button>
      </div>

      {/* Installed list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No libraries installed
            </p>
          ) : (
            items.map((ext) => (
              <div
                key={ext.name}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ext.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ext.global_name} &middot; v{ext.version}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {ext.load_type}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => handleUninstall(ext.name)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

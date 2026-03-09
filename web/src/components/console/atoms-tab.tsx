"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useStructure } from "@/lib/hooks";
import type { AtomType } from "@/lib/types";

interface AtomsTabProps {
  gameName: string;
}

const typeColors: Record<AtomType, "default" | "secondary" | "outline"> = {
  core: "default",
  feature: "secondary",
  util: "outline",
};

export function AtomsTab({ gameName }: AtomsTabProps) {
  const { data: atoms, isLoading } = useStructure(gameName);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = atoms ?? [];

  const grouped = {
    core: items.filter((a) => a.type === "core"),
    feature: items.filter((a) => a.type === "feature"),
    util: items.filter((a) => a.type === "util"),
  };

  const sections = (
    ["core", "feature", "util"] as const
  ).filter((t) => grouped[t].length > 0);

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No atoms yet. Use the chat to create some.
          </p>
        ) : (
          sections.map((type) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={typeColors[type]} className="text-[10px] uppercase">
                  {type}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  ({grouped[type].length})
                </span>
              </div>
              <div className="space-y-1.5">
                {grouped[type].map((atom) => (
                  <div
                    key={atom.name}
                    className="rounded-md border px-3 py-2"
                  >
                    <p className="text-sm font-mono font-medium">
                      {atom.name}
                    </p>
                    {(atom.inputs.length > 0 || atom.outputs.length > 0) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        ({atom.inputs.map((i) => `${i.name}: ${i.type}`).join(", ")})
                        {atom.outputs.length > 0 &&
                          ` → ${atom.outputs.map((o) => o.type).join(", ")}`}
                      </p>
                    )}
                    {atom.depends_on.length > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        deps: {atom.depends_on.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

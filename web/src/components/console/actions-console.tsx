"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalsTab } from "./externals-tab";
import { BuildsTab } from "./builds-tab";
import { AtomsTab } from "./atoms-tab";
import { SettingsTab } from "./settings-tab";
import { Package, History, Atom, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionsConsoleProps {
  gameName: string;
}

type ConsoleTab = "externals" | "builds" | "atoms" | "settings";

export function ActionsConsole({ gameName }: ActionsConsoleProps) {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("externals");
  const [visited, setVisited] = useState<Set<ConsoleTab>>(new Set(["externals"]));

  function handleTabChange(value: string) {
    const tab = value as ConsoleTab;
    setActiveTab(tab);
    setVisited((prev) => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full">
        <TabsList className="w-full justify-start rounded-none border-b border-white/[0.06] bg-transparent px-2 shrink-0">
          <TabsTrigger value="externals" className="gap-1.5 text-xs">
            <Package className="size-3.5" />
            Externals
          </TabsTrigger>
          <TabsTrigger value="builds" className="gap-1.5 text-xs">
            <History className="size-3.5" />
            Builds
          </TabsTrigger>
          <TabsTrigger value="atoms" className="gap-1.5 text-xs">
            <Atom className="size-3.5" />
            Atoms
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs">
            <Settings className="size-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Mount tabs on first visit, keep them alive with forceMount + CSS hide */}
        {visited.has("externals") && (
          <TabsContent value="externals" forceMount className={cn("flex-1 min-h-0 mt-0", activeTab !== "externals" && "hidden")}>
            <ExternalsTab gameName={gameName} />
          </TabsContent>
        )}
        {visited.has("builds") && (
          <TabsContent value="builds" forceMount className={cn("flex-1 min-h-0 mt-0", activeTab !== "builds" && "hidden")}>
            <BuildsTab gameName={gameName} />
          </TabsContent>
        )}
        {visited.has("atoms") && (
          <TabsContent value="atoms" forceMount className={cn("flex-1 min-h-0 mt-0", activeTab !== "atoms" && "hidden")}>
            <AtomsTab gameName={gameName} />
          </TabsContent>
        )}
        {visited.has("settings") && (
          <TabsContent value="settings" forceMount className={cn("flex-1 min-h-0 mt-0", activeTab !== "settings" && "hidden")}>
            <SettingsTab gameName={gameName} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

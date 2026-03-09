"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalsTab } from "./externals-tab";
import { BuildsTab } from "./builds-tab";
import { AtomsTab } from "./atoms-tab";
import { SettingsTab } from "./settings-tab";
import { Package, History, Atom, Settings } from "lucide-react";

interface ActionsConsoleProps {
  gameName: string;
}

export function ActionsConsole({ gameName }: ActionsConsoleProps) {
  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="externals" className="flex flex-col h-full">
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

        <TabsContent value="externals" className="flex-1 min-h-0 mt-0">
          <ExternalsTab gameName={gameName} />
        </TabsContent>
        <TabsContent value="builds" className="flex-1 min-h-0 mt-0">
          <BuildsTab gameName={gameName} />
        </TabsContent>
        <TabsContent value="atoms" className="flex-1 min-h-0 mt-0">
          <AtomsTab gameName={gameName} />
        </TabsContent>
        <TabsContent value="settings" className="flex-1 min-h-0 mt-0">
          <SettingsTab gameName={gameName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

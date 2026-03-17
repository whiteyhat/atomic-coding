"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";

type ProviderComponent = ComponentType<{ children: ReactNode }>;

export function DeferredPlatformAidProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [Provider, setProvider] = useState<ProviderComponent | null>(null);

  useEffect(() => {
    let active = true;

    import("./platform-aid-provider").then((module) => {
      if (active) {
        setProvider(() => module.PlatformAidProvider);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (!Provider) {
    return <>{children}</>;
  }

  return <Provider>{children}</Provider>;
}

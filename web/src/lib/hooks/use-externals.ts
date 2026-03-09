import useSWR from "swr";
import { listExternals, listRegistry } from "@/lib/api";

export function useExternals(gameName: string | null) {
  return useSWR(
    gameName ? `externals:${gameName}` : null,
    () => listExternals(gameName!),
  );
}

export function useRegistry() {
  return useSWR("registry", listRegistry);
}

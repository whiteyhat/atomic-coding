import useSWR from "swr";
import { getStructure } from "@/lib/api";

export function useStructure(gameName: string | null, typeFilter?: string) {
  const key = gameName ? `structure:${gameName}:${typeFilter ?? "all"}` : null;
  return useSWR(key, () => getStructure(gameName!, typeFilter), { keepPreviousData: true });
}

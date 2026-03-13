"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { AssetModel, AssetModelPage } from "./types";
import { BUU_API_URL } from "./constants";

const API_URL = `${BUU_API_URL}/v1/models/public`;
const PAGE_SIZE = 20;

export interface UseAssetModelsReturn {
  items: AssetModel[];
  filteredItems: AssetModel[];
  search: string;
  setSearch: (q: string) => void;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
}

export function useAssetModels(): UseAssetModelsReturn {
  const [items, setItems] = useState<AssetModel[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchPage = useCallback(
    async (pageOffset: number, append: boolean) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_URL}?limit=${PAGE_SIZE}&offset=${pageOffset}`
        );
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data: AssetModelPage = await res.json();
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setHasMore(pageOffset + PAGE_SIZE < data.metadata.numElements);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load models"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    fetchPage(nextOffset, true);
  }, [isLoading, hasMore, offset, fetchPage]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (m) => m.prompt?.toLowerCase().includes(q)
    );
  }, [items, search]);

  return {
    items,
    filteredItems,
    search,
    setSearch,
    isLoading,
    error,
    hasMore,
    loadMore,
  };
}

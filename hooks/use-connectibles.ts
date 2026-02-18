"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Connectible } from "@/lib/types/connectible";

interface UseConnectiblesOptions {
  search?: string;
  enabled?: boolean;
}

interface UseConnectiblesResult {
  connectibles: Connectible[];
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  fetchMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useConnectibles(
  options: UseConnectiblesOptions = {},
): UseConnectiblesResult {
  const { search = "", enabled = true } = options;
  const [connectibles, setConnectibles] = useState<Connectible[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cursorRef = useRef<string | undefined>(undefined);

  const fetchConnectibles = useCallback(async () => {
    if (!enabled) {
      setConnectibles([]);
      setHasMore(false);
      cursorRef.current = undefined;
      return;
    }

    setIsLoading(true);
    setError(null);
    cursorRef.current = undefined;

    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("q", search);
      }

      const response = await fetch(
        `/api/connectibles/search?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch connectibles");
      }

      const data = await response.json();
      setConnectibles(data.connectibles || []);
      cursorRef.current = data.cursor || undefined;
      setHasMore(!!data.cursor);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch connectibles"),
      );
      setConnectibles([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [search, enabled]);

  const fetchMore = useCallback(async () => {
    if (!cursorRef.current || isFetchingMore) return;

    setIsFetchingMore(true);

    try {
      const params = new URLSearchParams({ cursor: cursorRef.current });

      const response = await fetch(
        `/api/connectibles/search?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch more connectibles");
      }

      const data = await response.json();
      setConnectibles((prev) => [...prev, ...(data.connectibles || [])]);
      cursorRef.current = data.cursor || undefined;
      setHasMore(!!data.cursor);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch connectibles"),
      );
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore]);

  useEffect(() => {
    fetchConnectibles();
  }, [fetchConnectibles]);

  return {
    connectibles,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    fetchMore,
    refetch: fetchConnectibles,
  };
}

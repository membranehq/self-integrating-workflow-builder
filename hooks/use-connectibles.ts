"use client";

import { useCallback, useEffect, useState } from "react";
import type { Connectible } from "@/lib/types/connectible";

interface UseConnectiblesOptions {
  search?: string;
  enabled?: boolean;
}

interface UseConnectiblesResult {
  connectibles: Connectible[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useConnectibles(
  options: UseConnectiblesOptions = {}
): UseConnectiblesResult {
  const { search = "", enabled = true } = options;
  const [connectibles, setConnectibles] = useState<Connectible[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchConnectibles = useCallback(async () => {
    if (!enabled) {
      setConnectibles([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (search.trim()) {
        params.set("q", search);
      }

      const response = await fetch(
        `/api/connectibles/search?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch connectibles");
      }

      const data = await response.json();
      setConnectibles(data.connectibles || []);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch connectibles")
      );
      setConnectibles([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, enabled]);

  useEffect(() => {
    fetchConnectibles();
  }, [fetchConnectibles]);

  return { connectibles, isLoading, error, refetch: fetchConnectibles };
}

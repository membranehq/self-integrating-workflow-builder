"use client";

import { useCallback, useEffect, useState } from "react";

export interface MembraneAction {
  key: string;
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, {
      type?: string;
      description?: string;
    }>;
    required?: string[];
  };
}

interface UseMembraneActionsResult {
  actions: MembraneAction[];
  isLoading: boolean;
  error: Error | null;
}

export function useMembraneActions(
  externalAppId: string | undefined | null
): UseMembraneActionsResult {
  const [actions, setActions] = useState<MembraneAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchActions = useCallback(async () => {
    if (!externalAppId) {
      setActions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ externalAppId });
      const response = await fetch(
        `/api/membrane/actions?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch actions");
      }

      const data = await response.json();
      setActions(data.actions || []);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch actions")
      );
      setActions([]);
    } finally {
      setIsLoading(false);
    }
  }, [externalAppId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  return { actions, isLoading, error };
}

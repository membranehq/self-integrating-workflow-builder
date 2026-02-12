"use client";

import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { actionsRefetchAtom } from "@/lib/membrane-store";

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
  externalAppId: string | undefined | null,
  connectionId?: string | null
): UseMembraneActionsResult {
  const [actions, setActions] = useState<MembraneAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const refetchCounter = useAtomValue(actionsRefetchAtom);

  const fetchActions = useCallback(async () => {
    if (!externalAppId && !connectionId) {
      setActions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (connectionId) {
        params.set("connectionId", connectionId);
      } else if (externalAppId) {
        params.set("externalAppId", externalAppId);
      }
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
  }, [externalAppId, connectionId]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions, refetchCounter]);

  return { actions, isLoading, error };
}

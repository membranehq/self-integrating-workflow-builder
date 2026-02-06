"use client";

import { useCallback, useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { membraneServicesAtom, type MembraneService } from "@/lib/membrane-store";

interface UseMembraneIntegrationsResult {
  services: MembraneService[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMembraneIntegrations(): UseMembraneIntegrationsResult {
  const services = useAtomValue(membraneServicesAtom);
  const setAtom = useSetAtom(membraneServicesAtom);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/membrane/integrations");

      if (!response.ok) {
        throw new Error("Failed to fetch integrations");
      }

      const data = await response.json();
      const integrations: MembraneService[] = data.services || [];
      setAtom(integrations);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch integrations")
      );
    } finally {
      setIsLoading(false);
    }
  }, [setAtom]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  return { services, isLoading, error, refetch: fetchIntegrations };
}

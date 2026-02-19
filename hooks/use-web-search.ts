"use client";

import { useEffect, useRef, useState } from "react";
import type { WebSearchApp } from "@/lib/types/web-search-app";

interface UseWebSearchOptions {
  query: string;
}

interface UseWebSearchResult {
  results: WebSearchApp[];
  isLoading: boolean;
}

export function useWebSearch({
  query,
}: UseWebSearchOptions): UseWebSearchResult {
  const [results, setResults] = useState<WebSearchApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const activeQueryRef = useRef("");

  useEffect(() => {
    const trimmed = query.trim();
    activeQueryRef.current = trimmed;

    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setResults([]);

    const params = new URLSearchParams({ q: trimmed });
    fetch(`/api/web-search?${params.toString()}`)
      .then((response) => {
        console.log(
          "[useWebSearch] response received, active:",
          activeQueryRef.current,
          "this:",
          trimmed,
        );
        if (activeQueryRef.current !== trimmed) return;
        if (!response.ok) {
          setResults([]);
          setIsLoading(false);
          return;
        }
        return response.json();
      })
      .then((data) => {
        console.log(
          "[useWebSearch] data:",
          data,
          "active:",
          activeQueryRef.current,
          "this:",
          trimmed,
        );
        if (activeQueryRef.current !== trimmed) return;
        if (data) setResults(data.results || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.log("[useWebSearch] error:", err);
        if (activeQueryRef.current !== trimmed) return;
        setResults([]);
        setIsLoading(false);
      });
  }, [query]);

  return { results, isLoading };
}

"use client";

import { Globe, Plug, Search, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useConnectibles } from "@/hooks/use-connectibles";
import { useDebounce } from "@/hooks/use-debounce";
import { useMembraneIntegrations } from "@/hooks/use-membrane-integrations";
import { useWebSearch } from "@/hooks/use-web-search";
import type { Connectible } from "@/lib/types/connectible";
import type { WebSearchApp } from "@/lib/types/web-search-app";
import { BuildIntegrationOverlay } from "./build-integration-overlay";
import { Overlay } from "./overlay";
import { useOverlay } from "./overlay-provider";

type AddServiceOverlayProps = {
  overlayId: string;
};

export function AddServiceOverlay({ overlayId }: AddServiceOverlayProps) {
  const { closeAll, push } = useOverlay();
  const { refetch } = useMembraneIntegrations();
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { connectibles, isLoading, isFetchingMore, hasMore, error, fetchMore } =
    useConnectibles({
      search: debouncedSearch,
      enabled: true,
    });

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          fetchMore();
        }
      },
      { root: container, rootMargin: "100px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, fetchMore]);

  const { results: webResults, isLoading: isWebSearchLoading } = useWebSearch({
    query: debouncedSearch,
  });

  const handleBuildIntegration = () => {
    push(BuildIntegrationOverlay, { initialAppName: search.trim() });
  };

  const handleSelectWebResult = (app: WebSearchApp) => {
    push(BuildIntegrationOverlay, {
      initialAppName: app.name,
      initialAppUrl: app.websiteUrl,
    });
  };

  const handleSelect = async (connectible: Connectible) => {
    setIsAdding(true);
    try {
      const response = await fetch("/api/membrane/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: connectible.name,
          logoUri: connectible.logoUri,
          connectorId:
            connectible.connectParameters.connectorId ||
            connectible.connector?.id,
          integrationKey: connectible.integration?.key,
          externalAppId: connectible.externalApp?.id,
        }),
      });

      if (!response.ok) {
        toast.error("Failed to add service");
        return;
      }

      await refetch();
      closeAll();
      toast.success(`${connectible.name} added`, {
        description: "You can now select it from the services list.",
      });
    } catch (err) {
      console.error("Failed to add service:", err);
      toast.error("Failed to add service");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Overlay
      actions={[{ label: "Done", onClick: closeAll }]}
      overlayId={overlayId}
      title="Add Service"
    >
      <div className="flex flex-col gap-4">
        <div className="relative shrink-0">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9"
            disabled={isAdding}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services..."
            value={search}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto" ref={scrollContainerRef}>
          {isAdding ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : error ? (
                <div className="py-8 text-center">
                  <p className="text-destructive text-sm">
                    Failed to load services
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    Please try again
                  </p>
                </div>
              ) : connectibles.length > 0 ? (
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  }}
                >
                  {connectibles.map((connectible, index) => {
                    const id =
                      connectible.integration?.id ||
                      connectible.externalApp?.id ||
                      connectible.connector?.id ||
                      connectible.name;

                    return (
                      <button
                        className="relative flex flex-col items-center gap-2 rounded-lg p-3 transition-colors hover:bg-muted"
                        key={`${id}-${index}`}
                        onClick={() => handleSelect(connectible)}
                        type="button"
                      >
                        <div className="relative size-10">
                          {connectible.logoUri ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt={`${connectible.name} logo`}
                              className="size-full rounded object-contain"
                              src={connectible.logoUri}
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center rounded bg-muted font-medium text-muted-foreground text-lg">
                              {connectible.name[0]}
                            </div>
                          )}
                          {connectible.integration && (
                            <div className="absolute -top-1 -left-1 rounded-full bg-green-500 p-0.5">
                              <Plug className="size-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <span className="w-full truncate text-center text-xs">
                          {connectible.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : !isWebSearchLoading && webResults.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  No services found
                </p>
              ) : null}

              {(webResults.length > 0 || isWebSearchLoading) &&
                debouncedSearch.trim() && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Globe className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs font-medium">
                        From the web
                      </span>
                      {isWebSearchLoading && <Spinner className="size-3" />}
                    </div>
                    {webResults.length > 0 && (
                      <div
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns:
                            "repeat(auto-fill, minmax(80px, 1fr))",
                        }}
                      >
                        {webResults.map((app) => (
                          <button
                            className="relative flex flex-col items-center gap-1 rounded-lg p-3 transition-colors hover:bg-muted"
                            key={app.websiteUrl}
                            onClick={() => handleSelectWebResult(app)}
                            type="button"
                          >
                            <div className="relative size-10">
                              <div className="flex size-full items-center justify-center rounded bg-muted font-medium text-muted-foreground text-lg">
                                {app.name[0]}
                              </div>
                              <div className="absolute -top-1 -left-1 rounded-full bg-blue-500 p-0.5">
                                <Globe className="size-2.5 text-white" />
                              </div>
                            </div>
                            <span className="w-full truncate text-center text-xs">
                              {app.name}
                            </span>
                            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                              {app.websiteUrl
                                .replace(/^https?:\/\//, "")
                                .replace(/\/$/, "")}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              {/* Sentinel for infinite scroll */}
              <div ref={sentinelRef} />

              {isFetchingMore && (
                <div className="flex items-center justify-center py-4">
                  <Spinner />
                </div>
              )}

              {debouncedSearch.trim() && (
                <button
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 p-3 text-sm font-medium text-purple-600 transition-colors hover:border-purple-400 hover:bg-purple-50"
                  onClick={handleBuildIntegration}
                  type="button"
                >
                  <Sparkles className="size-4" />
                  Build integration from scratch
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

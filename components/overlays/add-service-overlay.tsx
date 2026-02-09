"use client";

import { Plug, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useConnectibles } from "@/hooks/use-connectibles";
import { useDebounce } from "@/hooks/use-debounce";
import { useMembraneIntegrations } from "@/hooks/use-membrane-integrations";
import type { Connectible } from "@/lib/types/connectible";
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

  const { connectibles, isLoading, error } = useConnectibles({
    search: debouncedSearch,
    enabled: true,
  });

  const handleBuildIntegration = () => {
    push(BuildIntegrationOverlay, { initialAppName: search.trim() });
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
        console.error("Failed to create integration");
        return;
      }

      await refetch();
      closeAll();
    } catch (err) {
      console.error("Failed to add service:", err);
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

        <div className="max-h-[300px] overflow-y-auto">
          {isAdding ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : isLoading ? (
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
          ) : (
            <>
              {connectibles.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  No services found
                </p>
              ) : (
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(80px, 1fr))",
                  }}
                >
                  {connectibles.map((connectible) => {
                    const id =
                      connectible.integration?.id ||
                      connectible.externalApp?.id ||
                      connectible.connector?.id ||
                      connectible.name;

                    return (
                      <button
                        className="relative flex flex-col items-center gap-2 rounded-lg p-3 transition-colors hover:bg-muted"
                        key={id}
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
              )}

              {debouncedSearch.trim() && (
                <button
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-purple-300 p-3 text-sm font-medium text-purple-600 transition-colors hover:border-purple-400 hover:bg-purple-50"
                  onClick={handleBuildIntegration}
                  type="button"
                >
                  <Sparkles className="size-4" />
                  Build integration for &ldquo;{debouncedSearch.trim()}&rdquo;
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

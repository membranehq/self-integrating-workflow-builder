"use client";

import { Plug, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useConnectibles } from "@/hooks/use-connectibles";
import { useDebounce } from "@/hooks/use-debounce";
import type { Connectible } from "@/lib/types/connectible";
import { Overlay } from "./overlay";
import { useOverlay } from "./overlay-provider";

type AddServiceOverlayProps = {
  overlayId: string;
  onSelect?: (connectible: Connectible) => void;
};

export function AddServiceOverlay({
  overlayId,
  onSelect,
}: AddServiceOverlayProps) {
  const { closeAll } = useOverlay();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { connectibles, isLoading, error } = useConnectibles({
    search: debouncedSearch,
    enabled: true,
  });

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services..."
            value={search}
          />
        </div>

        <div className="max-h-[300px] overflow-y-auto">
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
          ) : connectibles.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              No services found
            </p>
          ) : (
            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
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
                    onClick={() => onSelect?.(connectible)}
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
        </div>
      </div>
    </Overlay>
  );
}

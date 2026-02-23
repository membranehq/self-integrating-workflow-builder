"use client";

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Grid3X3,
  List,
  MoreHorizontal,
  Plug,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { IntegrationIcon } from "@/components/ui/integration-icon";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AddActionOverlay } from "@/components/overlays/add-action-overlay";
import { BuildIntegrationOverlay } from "@/components/overlays/build-integration-overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { useIntegrationApp } from "@membranehq/react";
import { useTheme } from "next-themes";
import { useAgentSession } from "@/hooks/use-agent-session";
import { useConnectibles } from "@/hooks/use-connectibles";
import { useDebounce } from "@/hooks/use-debounce";
import { useMembraneActions } from "@/hooks/use-membrane-actions";
import { useMembraneIntegrations } from "@/hooks/use-membrane-integrations";
import { useWebSearch } from "@/hooks/use-web-search";
import { openMembraneConnection } from "@/lib/membrane-connect";
import {
  actionSessionsAtom,
  type ActionSessionEntry,
  buildSessionsAtom,
  type BuildSessionEntry,
  membraneServicesAtom,
  type MembraneService,
} from "@/lib/membrane-store";
import type { Connectible } from "@/lib/types/connectible";
import type { WebSearchApp } from "@/lib/types/web-search-app";
import { useIsTouch } from "@/hooks/use-touch";
import { cn } from "@/lib/utils";
import { getAllActions } from "@/plugins";

type ActionType = {
  id: string;
  label: string;
  description: string;
  category: string;
  integration?: string;
};

// System actions that don't have plugins (currently disabled)
const SYSTEM_ACTIONS: ActionType[] = [];

// Combine System actions with plugin actions
function useAllActions(): ActionType[] {
  return useMemo(() => {
    const pluginActions = getAllActions();

    // Map plugin actions to ActionType format
    const mappedPluginActions: ActionType[] = pluginActions.map((action) => ({
      id: action.id,
      label: action.label,
      description: action.description,
      category: action.category,
      integration: action.integration,
    }));

    return [...SYSTEM_ACTIONS, ...mappedPluginActions];
  }, []);
}

type ActionGridProps = {
  onSelectAction: (actionType: string) => void;
  disabled?: boolean;
  isNewlyCreated?: boolean;
};

function GroupIcon({
  group,
}: {
  group: { category: string; actions: ActionType[] };
}) {
  // For plugin categories, use the integration icon from the first action
  const firstAction = group.actions[0];
  if (firstAction?.integration) {
    return (
      <IntegrationIcon
        className="size-4"
        integration={firstAction.integration}
      />
    );
  }
  // For System category
  if (group.category === "System") {
    return <Settings className="size-4" />;
  }
  return <Zap className="size-4" />;
}

function ActionIcon({
  action,
  className,
}: {
  action: ActionType;
  className?: string;
}) {
  if (action.integration) {
    return (
      <IntegrationIcon className={className} integration={action.integration} />
    );
  }
  if (action.category === "System") {
    return <Settings className={cn(className, "text-muted-foreground")} />;
  }
  return <Zap className={cn(className, "text-muted-foreground")} />;
}

// Local storage keys
const HIDDEN_GROUPS_KEY = "workflow-action-grid-hidden-groups";
const VIEW_MODE_KEY = "workflow-action-grid-view-mode";

type ViewMode = "list" | "grid";

function getInitialHiddenGroups(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(HIDDEN_GROUPS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function getInitialViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY);
    return stored === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

const AGENT_PHRASES = [
  "Agent is reading the docs",
  "Consulting the API gods",
  "Agent is wiring things up",
  "Teaching the endpoint manners",
  "Agent is on it",
  "Almost sentient, not quite",
  "Negotiating with the server",
  "Agent is cooking",
  "Reverse-engineering the universe",
  "Connecting the dots, literally",
];

function AnimatedDots() {
  const [dotCount, setDotCount] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((c) => (c % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);
  return (
    <span className="inline-block w-[1em] text-left">
      {".".repeat(dotCount)}
    </span>
  );
}

function useRotatingPhrase() {
  const [index, setIndex] = useState(
    () => Math.floor(Math.random() * AGENT_PHRASES.length),
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % AGENT_PHRASES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  return AGENT_PHRASES[index];
}

function ActionSessionPlaceholder({
  session,
  onDismiss,
}: {
  session: ActionSessionEntry;
  onDismiss: () => void;
}) {
  const isPending =
    session.status === "pending" || session.status === "building";
  const isSuccess = session.status === "success";
  const isError = session.status === "error";
  const phrase = useRotatingPhrase();

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm",
        isError && "bg-red-50 dark:bg-red-950/20",
        isSuccess && "bg-green-50 dark:bg-green-950/20",
      )}
    >
      {isPending && (
        <Spinner className="size-3.5 shrink-0 text-purple-500" />
      )}
      {isSuccess && (
        <Check className="size-3.5 shrink-0 text-green-600" />
      )}
      {isError && (
        <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-medium",
          isPending && "text-muted-foreground",
        )}
      >
        {session.description}
      </span>
      {isPending && (
        <span className="shrink-0 text-muted-foreground text-xs whitespace-nowrap">
          {phrase}
          <AnimatedDots />
        </span>
      )}
      {isSuccess && (
        <span className="shrink-0 text-green-600 text-xs">Ready</span>
      )}
      {isError && (
        <span className="shrink-0 truncate text-red-500 text-xs">
          {session.errorMessage || "Something went wrong"}
        </span>
      )}
      {isError && (
        <button
          className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
          onClick={onDismiss}
          title="Dismiss"
          type="button"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function BuildingFallback() {
  const phrase = useRotatingPhrase();
  return (
    <div className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm">
      <Spinner className="size-3.5 shrink-0 text-purple-500" />
      <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground">
        Building integration
      </span>
      <span className="shrink-0 text-muted-foreground text-xs whitespace-nowrap">
        {phrase}
        <AnimatedDots />
      </span>
    </div>
  );
}

function WebFavicon({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const domain = useMemo(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }, [url]);

  if (!domain || failed) {
    return (
      <div className="flex size-full items-center justify-center rounded bg-muted font-medium text-muted-foreground text-lg">
        {name[0]}
      </div>
    );
  }

  return (
    <img
      alt={name}
      className="size-full rounded object-contain"
      onError={() => setFailed(true)}
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
    />
  );
}

function BuildSessionPlaceholder({
  session,
  onDismiss,
}: {
  session: BuildSessionEntry;
  onDismiss: () => void;
}) {
  const isPending =
    session.status === "pending" || session.status === "building";
  const isSuccess = session.status === "success";
  const isError = session.status === "error";
  const phrase = useRotatingPhrase();

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm",
        isError && "bg-red-50 dark:bg-red-950/20",
        isSuccess && "bg-green-50 dark:bg-green-950/20",
      )}
    >
      {isPending && (
        <Spinner className="size-3.5 shrink-0 text-purple-500" />
      )}
      {isSuccess && (
        <Check className="size-3.5 shrink-0 text-green-600" />
      )}
      {isError && (
        <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-medium",
          isPending && "text-muted-foreground",
        )}
      >
        {isSuccess ? "Integration ready" : "Building integration"}
      </span>
      {isPending && (
        <span className="shrink-0 text-muted-foreground text-xs whitespace-nowrap">
          {phrase}
          <AnimatedDots />
        </span>
      )}
      {isSuccess && (
        <span className="shrink-0 text-green-600 text-xs">Ready</span>
      )}
      {isError && (
        <span className="shrink-0 truncate text-red-500 text-xs">
          {session.errorMessage || "Something went wrong"}
        </span>
      )}
      {isError && (
        <button
          className="shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
          onClick={onDismiss}
          title="Dismiss"
          type="button"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function MembraneServiceActions({
  service,
  onSelectAction,
  disabled,
}: {
  service: MembraneService;
  onSelectAction: (actionType: string) => void;
  disabled?: boolean;
}) {
  const { actions, isLoading } = useMembraneActions(
    service.externalAppId,
    service.connectionId,
  );
  const overlay = useOverlay();
  const integrationApp = useIntegrationApp();
  const { resolvedTheme } = useTheme();
  const setMembraneServices = useSetAtom(membraneServicesAtom);
  const actionSessions = useAtomValue(actionSessionsAtom);
  const setActionSessions = useSetAtom(actionSessionsAtom);
  const buildSessions = useAtomValue(buildSessionsAtom);
  const setBuildSessions = useSetAtom(buildSessionsAtom);
  const [isConnecting, setIsConnecting] = useState(false);
  const [preBuiltExpanded, setPreBuiltExpanded] = useState(false);

  const pendingSessions = actionSessions.filter(
    (s) => s.serviceId === service.id,
  );
  const pendingBuildSessions = buildSessions.filter(
    (s) => s.placeholderServiceId === service.id,
  );

  const handleAddConnection = async () => {
    if (!service.connectorId || !integrationApp) return;
    setIsConnecting(true);
    try {
      const result = await openMembraneConnection(
        integrationApp,
        service.connectorId,
        { theme: resolvedTheme === "dark" ? "dark" : "light" },
      );
      if (result?.connectionId) {
        await fetch("/api/membrane/integrations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: service.id,
            connectionId: result.connectionId,
          }),
        });
        setMembraneServices((prev) =>
          prev.map((s) =>
            s.id === service.id
              ? { ...s, connectionId: result.connectionId }
              : s,
          ),
        );
        toast.success(`Connected to ${service.name}`);
      }
    } catch (err) {
      console.error("Failed to connect:", err);
      toast.error("Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  // State 1: No connector yet — agent still building
  if (!service.connectionId && !service.connectorId) {
    return (
      <>
        {pendingBuildSessions.length > 0 ? (
          pendingBuildSessions.map((session) => (
            <BuildSessionPlaceholder
              key={session.sessionId}
              onDismiss={() =>
                setBuildSessions((prev) =>
                  prev.filter((s) => s.sessionId !== session.sessionId),
                )
              }
              session={session}
            />
          ))
        ) : (
          <BuildingFallback />
        )}
      </>
    );
  }

  // State 2: Has connector but no connection — show "Add connection"
  if (!service.connectionId) {
    return (
      <button
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/20"
        disabled={isConnecting}
        onClick={handleAddConnection}
        type="button"
      >
        {isConnecting ? (
          <Spinner className="size-3.5" />
        ) : (
          <Plug className="size-3.5" />
        )}
        {isConnecting ? "Connecting..." : "Add connection"}
      </button>
    );
  }

  // State 3: Connected — show actions + "Add new action"
  if (isLoading) {
    return (
      <p className="px-3 py-2 text-muted-foreground text-xs">Loading...</p>
    );
  }

  const customActions = actions.filter((a) => !a.isPublic);
  const preBuiltActions = actions.filter((a) => a.isPublic);

  const renderAction = (action: (typeof actions)[0]) => (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
        disabled && "pointer-events-none opacity-50",
      )}
      disabled={disabled}
      key={`${service.id}:${action.key}`}
      onClick={() =>
        onSelectAction(
          `membrane:${service.id}:${action.key}|${action.name}`,
        )
      }
      type="button"
    >
      {action.isPublic ? (
        <Zap className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <Sparkles className="size-3.5 shrink-0 text-purple-500" />
      )}
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{action.name}</span>
      </span>
    </button>
  );

  return (
    <>
      {pendingSessions.map((session) => (
        <ActionSessionPlaceholder
          key={session.sessionId}
          onDismiss={() =>
            setActionSessions((prev) =>
              prev.filter((s) => s.sessionId !== session.sessionId),
            )
          }
          session={session}
        />
      ))}
      {customActions.map(renderAction)}
      {preBuiltActions.length > 0 && (
        <div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-muted-foreground text-xs font-medium transition-colors hover:text-foreground"
            onClick={() => setPreBuiltExpanded((v) => !v)}
            type="button"
          >
            <ChevronRight
              className={cn(
                "size-3 transition-transform",
                preBuiltExpanded && "rotate-90",
              )}
            />
            Pre-built actions
            <span className="text-[10px] tabular-nums">
              ({preBuiltActions.length})
            </span>
          </button>
          {preBuiltExpanded && preBuiltActions.map(renderAction)}
        </div>
      )}
    </>
  );
}

function AddActionButton({ service }: { service: MembraneService }) {
  const overlay = useOverlay();
  return (
    <button
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-purple-600 text-xs font-medium normal-case tracking-normal hover:bg-purple-50 hover:text-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/20"
      onClick={(e) => {
        e.stopPropagation();
        overlay.open(AddActionOverlay, {
          serviceId: service.id,
          serviceName: service.name,
          externalAppId: service.externalAppId || "",
          connectorId: service.connectorId || "",
          connectionId: service.connectionId || "",
        });
      }}
      type="button"
    >
      <Plus className="size-3" />
      Add action
    </button>
  );
}

function InlineServiceSearch() {
  const { open: openOverlay } = useOverlay();
  const setMembraneServices = useSetAtom(membraneServicesAtom);
  const { startBuildSession } = useAgentSession();
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { connectibles, isLoading, isFetchingMore, hasMore, error, fetchMore } =
    useConnectibles({
      search: debouncedSearch,
      enabled: true,
    });

  // Infinite scroll via IntersectionObserver (uses viewport as root since
  // the parent action-grid div handles scrolling)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          fetchMore();
        }
      },
      { rootMargin: "100px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, fetchMore]);

  const { results: webResults, isLoading: isWebSearchLoading } = useWebSearch({
    query: debouncedSearch,
  });

  const handleBuildIntegration = async () => {
    const placeholder = await createPlaceholderService(search.trim());
    if (placeholder) {
      setMembraneServices((prev) => [placeholder, ...prev]);
    }
    openOverlay(BuildIntegrationOverlay, {
      initialAppName: search.trim(),
      placeholderServiceId: placeholder?.id,
    });
  };

  const handleSelectWebResult = async (app: WebSearchApp) => {
    const placeholder = await createPlaceholderService(app.name);
    if (placeholder) {
      setMembraneServices((prev) => [placeholder, ...prev]);
    }
    openOverlay(BuildIntegrationOverlay, {
      initialAppName: app.name,
      initialAppUrl: app.websiteUrl,
      placeholderServiceId: placeholder?.id,
    });
  };

  const createPlaceholderService = useCallback(
    async (name: string): Promise<MembraneService | null> => {
      try {
        const response = await fetch("/api/membrane/integrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) return null;
        const { service } = await response.json();
        return service as MembraneService;
      } catch {
        return null;
      }
    },
    [],
  );

  const handleSelect = async (connectible: Connectible) => {
    const hasConnector =
      connectible.connectParameters.connectorId || connectible.connector?.id;

    // Apps without a connector — start build session directly
    if (!hasConnector) {
      startBuildSession(
        connectible.name,
        connectible.externalApp?.websiteUrl || "",
        undefined,
        connectible.externalApp?.id,
      );
      return;
    }

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

      const { service } = await response.json();
      setMembraneServices((prev) => [service as MembraneService, ...prev]);
      toast.success(`${connectible.name} added`);
    } catch (err) {
      console.error("Failed to add service:", err);
      toast.error("Failed to add service");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          disabled={isAdding}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search services..."
          value={search}
        />
      </div>

      <div>
        {isAdding ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Section 1: Pre-built in Membrane */}
            <div className="mb-2 flex items-center gap-1.5">
              <Plug className="size-3.5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground text-xs">
                Pre-built in Membrane
              </span>
              {isLoading && <Spinner className="size-3" />}
            </div>

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
                      className="group relative flex flex-col items-center gap-2 rounded-lg p-3"
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
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/80 font-medium text-background text-sm opacity-0 transition-opacity group-hover:opacity-100">
                        Connect
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-center text-muted-foreground text-sm">
                No services found
              </p>
            )}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} />

            {isFetchingMore && (
              <div className="flex items-center justify-center py-4">
                <Spinner />
              </div>
            )}

            {/* Section 2: Build from scratch */}
            {debouncedSearch.trim() && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground text-xs">
                    Build from scratch
                  </span>
                  {isWebSearchLoading && <Spinner className="size-3" />}
                </div>
                {isWebSearchLoading && webResults.length === 0 ? (
                  <p className="py-4 text-center text-muted-foreground text-sm">
                    Searching the web...
                  </p>
                ) : (
                  <div
                    className="grid gap-2"
                    style={{
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(80px, 1fr))",
                    }}
                  >
                    {webResults.map((app) => (
                      <button
                        className="group relative flex flex-col items-center gap-1 rounded-lg p-3"
                        key={app.websiteUrl}
                        onClick={() => handleSelectWebResult(app)}
                        type="button"
                      >
                        <div className="relative size-10">
                          <WebFavicon name={app.name} url={app.websiteUrl} />
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
                        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-foreground/80 font-medium text-background text-sm opacity-0 transition-opacity group-hover:opacity-100">
                          Connect
                        </div>
                      </button>
                    ))}
                    {/* Build from scratch — always last in the grid */}
                    {!isWebSearchLoading && (
                      <button
                        className="relative flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-purple-300 p-3 transition-colors hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                        onClick={handleBuildIntegration}
                        type="button"
                      >
                        <div className="flex size-10 items-center justify-center rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                          <Sparkles className="size-5" />
                        </div>
                        <span className="w-full truncate text-center text-xs font-medium text-purple-600 dark:text-purple-300">
                          Custom
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ActionGrid({
  onSelectAction,
  disabled,
  isNewlyCreated,
}: ActionGridProps) {
  const [filter, setFilter] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(
    getInitialHiddenGroups,
  );
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  const actions = useAllActions();
  const { services: membraneServices } = useMembraneIntegrations();
  const inputRef = useRef<HTMLInputElement>(null);
  const isTouch = useIsTouch();

  const toggleViewMode = () => {
    const newMode = viewMode === "list" ? "grid" : "list";
    setViewMode(newMode);
    localStorage.setItem(VIEW_MODE_KEY, newMode);
  };

  const toggleGroup = (category: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleHideGroup = (category: string) => {
    setHiddenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      // Persist to localStorage
      localStorage.setItem(HIDDEN_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    // Only focus after touch detection is complete (isTouch !== undefined)
    // and only on non-touch devices to avoid opening the keyboard
    if (isNewlyCreated && isTouch === false && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isNewlyCreated, isTouch]);

  // Filter Membrane services by search
  const filteredMembraneServices = useMemo(() => {
    if (!filter) return membraneServices;
    const searchTerm = filter.toLowerCase();
    return membraneServices.filter((s) =>
      s.name.toLowerCase().includes(searchTerm),
    );
  }, [membraneServices, filter]);

  const filteredActions = actions.filter((action) => {
    const searchTerm = filter.toLowerCase();
    return (
      action.label.toLowerCase().includes(searchTerm) ||
      action.description.toLowerCase().includes(searchTerm) ||
      action.category.toLowerCase().includes(searchTerm)
    );
  });

  // Group actions by category
  const groupedActions = useMemo(() => {
    const groups: Record<string, ActionType[]> = {};

    for (const action of filteredActions) {
      const category = action.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(action);
    }

    // Sort categories: System first, then alphabetically
    const sortedCategories = Object.keys(groups).sort((a, b) => {
      if (a === "System") return -1;
      if (b === "System") return 1;
      return a.localeCompare(b);
    });

    return sortedCategories.map((category) => ({
      category,
      actions: groups[category],
    }));
  }, [filteredActions]);

  // Filter groups based on hidden state
  const visibleGroups = useMemo(() => {
    if (showHidden) return groupedActions;
    return groupedActions.filter((g) => !hiddenGroups.has(g.category));
  }, [groupedActions, hiddenGroups, showHidden]);

  const hiddenCount = hiddenGroups.size;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Search and view mode controls — commented out during revamp
      <div className="flex shrink-0 gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            data-testid="action-search-input"
            disabled={disabled}
            id="action-filter"
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search actions..."
            ref={inputRef}
            value={filter}
          />
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="shrink-0"
                onClick={toggleViewMode}
                size="icon"
                variant="ghost"
              >
                {viewMode === "list" ? (
                  <Grid3X3 className="size-4" />
                ) : (
                  <List className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {viewMode === "list" ? "Grid view" : "List view"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {hiddenCount > 0 && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={cn("shrink-0", showHidden && "bg-muted")}
                  onClick={() => setShowHidden(!showHidden)}
                  size="icon"
                  variant="ghost"
                >
                  {showHidden ? (
                    <Eye className="size-4" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {showHidden
                  ? "Hide hidden groups"
                  : `Show ${hiddenCount} hidden group${hiddenCount > 1 ? "s" : ""}`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      */}

      <div
        className="min-h-0 flex-1 overflow-y-auto pb-4"
        data-testid="action-grid"
      >

        {/* Grid View */}
        {viewMode === "grid" &&
          (visibleGroups.length > 0 || filteredMembraneServices.length > 0) && (
            <div
              className="grid gap-2 p-1"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
              }}
            >
              {filteredMembraneServices.map((service) => (
                <button
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-transparent p-2 text-center transition-colors hover:border-border hover:bg-muted",
                    disabled && "pointer-events-none opacity-50",
                  )}
                  disabled={disabled}
                  key={`membrane:${service.id}`}
                  type="button"
                >
                  {service.logoUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={service.name}
                      className="size-6 rounded object-contain"
                      src={service.logoUri}
                    />
                  ) : (
                    <div className="flex size-6 items-center justify-center rounded bg-muted font-medium text-muted-foreground text-xs">
                      {service.name[0]}
                    </div>
                  )}
                  <span className="line-clamp-2 font-medium text-xs leading-tight">
                    {service.name}
                  </span>
                </button>
              ))}
              {filteredActions
                .filter(
                  (action) => showHidden || !hiddenGroups.has(action.category),
                )
                .map((action) => (
                  <button
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-transparent p-2 text-center transition-colors hover:border-border hover:bg-muted",
                      disabled && "pointer-events-none opacity-50",
                    )}
                    data-testid={`action-option-${action.id.toLowerCase().replace(/\s+/g, "-")}`}
                    disabled={disabled}
                    key={action.id}
                    onClick={() => onSelectAction(action.id)}
                    type="button"
                  >
                    <ActionIcon action={action} className="size-6" />
                    <span className="line-clamp-2 font-medium text-xs leading-tight">
                      {action.label}
                    </span>
                  </button>
                ))}
            </div>
          )}

        {/* Membrane Service Groups (rendered first, above plugin groups) */}
        {viewMode === "list" &&
          filteredMembraneServices.map((service, i) => {
            const groupKey = `membrane:${service.id}`;
            const isCollapsed = collapsedGroups.has(groupKey);
            return (
              <div key={groupKey}>
                {i > 0 && <div className="my-2 h-px bg-border" />}
                <div className="sticky top-0 z-10 mb-1 flex items-center gap-2 bg-background px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  <button
                    className="flex flex-1 items-center gap-2 text-left hover:text-foreground"
                    onClick={() => toggleGroup(groupKey)}
                    type="button"
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform",
                        !isCollapsed && "rotate-90",
                      )}
                    />
                    {service.logoUri ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={service.name}
                        className="size-4 rounded object-contain"
                        src={service.logoUri}
                      />
                    ) : (
                      <div className="flex size-4 items-center justify-center rounded bg-muted font-medium text-muted-foreground text-[10px]">
                        {service.name[0]}
                      </div>
                    )}
                    {service.name}
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 font-medium text-purple-700 text-[10px] normal-case tracking-normal dark:bg-purple-900/30 dark:text-purple-300">
                      Membrane
                    </span>
                  </button>
                  {service.connectionId && (
                    <AddActionButton service={service} />
                  )}
                </div>
                {!isCollapsed && (
                  <MembraneServiceActions
                    disabled={disabled}
                    onSelectAction={onSelectAction}
                    service={service}
                  />
                )}
              </div>
            );
          })}

        {/* List View — Plugin Groups */}
        {viewMode === "list" &&
          visibleGroups.length > 0 &&
          visibleGroups.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.category);
            const isHidden = hiddenGroups.has(group.category);
            return (
              <div key={group.category}>
                {(groupIndex > 0 || filteredMembraneServices.length > 0) && (
                  <div className="my-2 h-px bg-border" />
                )}
                <div
                  className={cn(
                    "sticky top-0 z-10 mb-1 flex items-center gap-2 bg-background px-3 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider",
                    isHidden && "opacity-50",
                  )}
                >
                  <button
                    className="flex flex-1 items-center gap-2 text-left hover:text-foreground"
                    onClick={() => toggleGroup(group.category)}
                    type="button"
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform",
                        !isCollapsed && "rotate-90",
                      )}
                    />
                    <GroupIcon group={group} />
                    {group.category}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="rounded p-0.5 hover:bg-muted hover:text-foreground"
                        type="button"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => toggleHideGroup(group.category)}
                      >
                        {isHidden ? (
                          <>
                            <Eye className="mr-2 size-4" />
                            Show group
                          </>
                        ) : (
                          <>
                            <EyeOff className="mr-2 size-4" />
                            Hide group
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {!isCollapsed &&
                  group.actions.map((action) => (
                    <button
                      className={cn(
                        "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                        disabled && "pointer-events-none opacity-50",
                      )}
                      data-testid={`action-option-${action.id.toLowerCase().replace(/\s+/g, "-")}`}
                      disabled={disabled}
                      key={action.id}
                      onClick={() => onSelectAction(action.id)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{action.label}</span>
                        {action.description && (
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            - {action.description}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
              </div>
            );
          })}

        {/* Inline service search */}
        {(filteredMembraneServices.length > 0 ||
          visibleGroups.length > 0) && (
          <div className="my-2 h-px bg-border" />
        )}
        <div className="flex min-h-0 flex-1 flex-col px-1 py-2">
          <InlineServiceSearch />
        </div>
      </div>
    </div>
  );
}

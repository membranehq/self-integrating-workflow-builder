"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { toast } from "sonner";
import {
  actionsRefetchAtom,
  actionSessionsAtom,
  buildSessionsAtom,
  membraneServicesAtom,
  type MembraneService,
} from "@/lib/membrane-store";

const STORAGE_KEY = "membrane-agent-sessions";

type BuildIntegrationSession = {
  type: "build-integration";
  sessionId: string;
  appName: string;
  placeholderServiceId?: string;
};

type AddActionSession = {
  type: "add-action";
  sessionId: string;
  serviceId: string;
  serviceName: string;
  description: string;
  externalAppId: string;
  connectorId: string;
  connectionId: string;
};

type StoredSession = BuildIntegrationSession | AddActionSession;

type SessionStatus = {
  status: string;
  state: string;
  error?: { message: string };
  summary?: string;
};

function getStoredSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Migration: handle old single-session format
    if (parsed && !Array.isArray(parsed) && parsed.sessionId) {
      const migrated: StoredSession = {
        type: "build-integration",
        sessionId: parsed.sessionId,
        appName: parsed.appName,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([migrated]));
      return [migrated];
    }
    return parsed;
  } catch {
    return [];
  }
}

function addStoredSession(session: StoredSession) {
  const sessions = getStoredSessions();
  sessions.push(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function removeStoredSession(sessionId: string) {
  const sessions = getStoredSessions().filter((s) => s.sessionId !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

async function refetchIntegrations(): Promise<MembraneService[]> {
  const response = await fetch("/api/membrane/integrations");
  if (!response.ok) return [];
  const data = await response.json();
  return data.services || [];
}

/** Delete a placeholder service from the DB when a build session fails. */
async function deletePlaceholderService(serviceId?: string): Promise<void> {
  if (!serviceId) return;
  try {
    await fetch(`/api/membrane/integrations?id=${serviceId}`, {
      method: "DELETE",
    });
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Extract connector details from the agent's last message and add to local DB.
 * Falls back to search-by-name if message parsing fails.
 */
async function addBuiltService(
  sessionId: string,
  appName: string,
  existingServiceId?: string,
): Promise<boolean> {
  // Helper: either PATCH existing placeholder or POST new service
  async function saveService(data: Record<string, string | undefined>): Promise<boolean> {
    if (existingServiceId) {
      const response = await fetch("/api/membrane/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existingServiceId, ...data }),
      });
      return response.ok;
    }
    const response = await fetch("/api/membrane/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return response.ok;
  }

  // Try extracting from session messages first
  try {
    const response = await fetch(
      `/api/membrane/sessions?sessionId=${sessionId}&includeMessages=1`,
    );
    if (response.ok) {
      const data = await response.json();
      const messages = data.messages;
      if (Array.isArray(messages) && messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const textPart = lastMessage?.parts?.find(
          (p: { type: string }) => p.type === "text",
        );
        if (textPart?.text) {
          const details = extractConnectorDetails(textPart.text);
          if (details) {
            const ok = await saveService({
              name: details.appName || details.connectorName || appName,
              connectorId: details.connectorId,
            });
            if (ok) return true;
          }
        }
      }
    }
  } catch (err) {
    console.error("[addBuiltService] Message extraction failed:", err);
  }

  // Fallback: search by name
  try {
    const searchResponse = await fetch(
      `/api/connectibles/search?q=${encodeURIComponent(appName)}`,
    );
    if (!searchResponse.ok) return false;

    const { connectibles } = await searchResponse.json();
    if (!connectibles || connectibles.length === 0) return false;

    const match =
      connectibles.find(
        (c: { name: string }) => c.name.toLowerCase() === appName.toLowerCase(),
      ) || connectibles[0];

    const ok = await saveService({
      name: match.name,
      logoUri: match.logoUri,
      connectorId:
        match.connectParameters?.connectorId || match.connector?.id,
      integrationKey: match.integration?.key,
      externalAppId: match.externalApp?.id,
    });

    return ok;
  } catch (err) {
    console.error("[addBuiltService] Fallback search failed:", err);
    return false;
  }
}

function extractConnectorDetails(text: string): {
  connectorId?: string;
  connectorName?: string;
  appName?: string;
} | null {
  // Extract connector ID from membrane://connector/{id} link
  const connectorIdMatch = text.match(/membrane:\/\/connector\/([a-f0-9]+)/);
  if (!connectorIdMatch) return null;

  const connectorId = connectorIdMatch[1];

  // Extract app name
  const appNameMatch = text.match(/\*\*App Name\*\*:\s*(.+)/);
  const appName = appNameMatch?.[1]?.trim();

  // Extract connector name (may be in a markdown link)
  const connectorNameMatch = text.match(
    /\*\*Connector Name\*\*:\s*(?:\[([^\]]+)\]|(.+))/,
  );
  const connectorName = (
    connectorNameMatch?.[1] || connectorNameMatch?.[2]
  )?.trim();

  return { connectorId, connectorName, appName };
}

function buildIntegrationPrompt(appName: string, appUrl: string, externalAppId?: string): string {
  if (externalAppId) {
    return `Build new app connector.
App Name: ${appName.trim()}
App URL: ${appUrl.trim() || "Not provided"}
External App ID: ${externalAppId}
This app already exists in the system. Look up the external app by its ID to get more details. Link the new connector to this existing app.`;
  }
  return `Build new app connector.
App Name: ${appName.trim()}
App URL: ${appUrl.trim() || "Not provided"}`;
}

function addActionPrompt(
  serviceName: string,
  connectorId: string,
  connectionId: string,
  externalAppId: string,
  actionDescription: string,
): string {
  return `I need to create a new action for a tenant-level connector.

Connector ID: ${connectorId}
Connector Name: ${serviceName}
Connection ID: ${connectionId || "Not available"}
External App ID: ${externalAppId || "Not available"}
External App Name: ${serviceName}

The External App entity contains the app's URL. Use it to find and research the app's API documentation before building the action.

User's description of what the action should do:
${actionDescription.trim()}

IMPORTANT RULES:
- If there is already a pre-built action that does the same as the one requested by the user - duplicate it, but don't stop the session until the action is created.
- When using the "api-request-to-external-app" action type, use relative paths (e.g. "/conversations.members") instead of full URLs. This action type automatically handles the base URL and authentication.`;
}

function getFailureMessage(session: StoredSession, status: string): string {
  const action =
    session.type === "build-integration"
      ? `building ${session.appName} integration`
      : `adding action to ${session.serviceName}`;
  if (status === "cancelled") {
    return `Session ${status} while ${action}.`;
  }
  return `Failed ${action}. Please try again.`;
}

export function useAgentSession() {
  const [buildingSessionIds, setBuildingSessionIds] = useState<Set<string>>(
    new Set(),
  );
  const setMembraneServices = useSetAtom(membraneServicesAtom);
  const setActionsRefetch = useSetAtom(actionsRefetchAtom);
  const setActionSessions = useSetAtom(actionSessionsAtom);
  const setBuildSessions = useSetAtom(buildSessionsAtom);
  const pollingRef = useRef<Set<string>>(new Set());

  const isBuilding = buildingSessionIds.size > 0;

  const pollSession = useCallback(
    async (session: StoredSession) => {
      if (pollingRef.current.has(session.sessionId)) return;
      pollingRef.current.add(session.sessionId);
      setBuildingSessionIds((prev) => new Set([...prev, session.sessionId]));

      const isAddAction = session.type === "add-action";

      if (isAddAction) {
        setActionSessions((prev) =>
          prev.map((s) =>
            s.sessionId === session.sessionId
              ? { ...s, status: "building" as const }
              : s,
          ),
        );
      } else {
        setBuildSessions((prev) =>
          prev.map((s) =>
            s.sessionId === session.sessionId
              ? { ...s, status: "building" as const }
              : s,
          ),
        );
      }

      try {
        while (pollingRef.current.has(session.sessionId)) {
          let data: SessionStatus;
          try {
            const response = await fetch(
              `/api/membrane/sessions?sessionId=${session.sessionId}&wait=1&timeout=30`,
            );
            if (!response.ok) {
              console.error("[AgentSession] Poll failed:", response.status);
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            data = await response.json();
          } catch (err) {
            console.error("[AgentSession] Poll error:", err);
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }

          if (data.status === "failed" || data.status === "cancelled" || data.status === "stopped") {
            removeStoredSession(session.sessionId);
            if (isAddAction) {
              setActionSessions((prev) =>
                prev.map((s) =>
                  s.sessionId === session.sessionId
                    ? { ...s, status: "error" as const, errorMessage: getFailureMessage(session, data.status) }
                    : s,
                ),
              );
            } else {
              if (session.type === "build-integration") {
                await deletePlaceholderService(session.placeholderServiceId);
                const services = await refetchIntegrations();
                setMembraneServices(services);
              }
              setBuildSessions((prev) =>
                prev.map((s) =>
                  s.sessionId === session.sessionId
                    ? { ...s, status: "error" as const, errorMessage: getFailureMessage(session, data.status) }
                    : s,
                ),
              );
            }
            break;
          }

          if (data.state === "idle" || data.status === "completed") {
            removeStoredSession(session.sessionId);

            if (session.type === "build-integration") {
              await addBuiltService(session.sessionId, session.appName, session.placeholderServiceId);
              const services = await refetchIntegrations();
              setMembraneServices(services);
              setBuildSessions((prev) =>
                prev.map((s) =>
                  s.sessionId === session.sessionId
                    ? { ...s, status: "success" as const }
                    : s,
                ),
              );
              setTimeout(() => {
                setBuildSessions((prev) =>
                  prev.filter((s) => s.sessionId !== session.sessionId),
                );
              }, 2000);
            } else {
              setActionsRefetch((c) => c + 1);
              setActionSessions((prev) =>
                prev.map((s) =>
                  s.sessionId === session.sessionId
                    ? { ...s, status: "success" as const }
                    : s,
                ),
              );
              setTimeout(() => {
                setActionSessions((prev) =>
                  prev.filter((s) => s.sessionId !== session.sessionId),
                );
              }, 2000);
            }
            break;
          }
        }
      } finally {
        pollingRef.current.delete(session.sessionId);
        setBuildingSessionIds((prev) => {
          const next = new Set(prev);
          next.delete(session.sessionId);
          return next;
        });
      }
    },
    [setMembraneServices, setActionsRefetch, setActionSessions, setBuildSessions],
  );

  const startBuildSession = useCallback(
    async (appName: string, appUrl: string, placeholderServiceId?: string, externalAppId?: string) => {
      const prompt = buildIntegrationPrompt(appName, appUrl, externalAppId);

      // Create placeholder service in DB if not already provided
      let serviceId = placeholderServiceId;
      if (!serviceId) {
        try {
          const res = await fetch("/api/membrane/integrations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: appName }),
          });
          if (res.ok) {
            const { service } = await res.json();
            serviceId = service.id;
            setMembraneServices((prev) => [service as MembraneService, ...prev]);
          }
        } catch {
          // Continue without placeholder
        }
      }

      const session: BuildIntegrationSession = {
        type: "build-integration",
        sessionId: "", // filled after POST
        appName,
        placeholderServiceId: serviceId,
      };

      toast.info(
        `An agent is building the ${appName} integration. This can take a couple of minutes — you can track progress in the side panel.`,
        { duration: 6000, closeButton: true },
      );

      const tempId = `pending-build-${Date.now()}`;

      // Show inline placeholder immediately
      setBuildSessions((prev) => [
        ...prev,
        {
          sessionId: tempId,
          placeholderServiceId: serviceId,
          appName,
          status: "pending" as const,
        },
      ]);

      try {
        const response = await fetch("/api/membrane/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, agentName: "connection-building" }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setBuildSessions((prev) =>
            prev.map((s) =>
              s.sessionId === tempId
                ? { ...s, status: "error" as const, errorMessage: data.error || "Failed to start integration build" }
                : s,
            ),
          );
          return;
        }

        const { sessionId } = await response.json();
        session.sessionId = sessionId;
        addStoredSession(session);

        // Update placeholder with real sessionId
        setBuildSessions((prev) =>
          prev.map((s) =>
            s.sessionId === tempId
              ? { ...s, sessionId, status: "building" as const }
              : s,
          ),
        );

        pollSession(session);
      } catch {
        setBuildSessions((prev) =>
          prev.map((s) =>
            s.sessionId === tempId
              ? { ...s, status: "error" as const, errorMessage: "Failed to start integration build" }
              : s,
          ),
        );
      }
    },
    [pollSession, setBuildSessions, setMembraneServices],
  );

  const startAddActionSession = useCallback(
    async (
      serviceId: string,
      serviceName: string,
      externalAppId: string,
      connectorId: string,
      connectionId: string,
      actionDescription: string,
    ) => {
      const prompt = addActionPrompt(
        serviceName,
        connectorId,
        connectionId,
        externalAppId,
        actionDescription,
      );
      const session: AddActionSession = {
        type: "add-action",
        sessionId: "", // filled after POST
        serviceId,
        serviceName,
        description: actionDescription,
        externalAppId,
        connectorId,
        connectionId,
      };

      toast.info(
        `An agent is building your "${actionDescription}" action for ${serviceName}. This can take a couple of minutes — you can track progress in the side panel.`,
        { duration: 6000, closeButton: true },
      );

      const tempId = `pending-${Date.now()}`;

      // Show inline placeholder immediately
      setActionSessions((prev) => [
        ...prev,
        {
          sessionId: tempId,
          serviceId,
          description: actionDescription,
          status: "pending" as const,
        },
      ]);

      try {
        const response = await fetch("/api/membrane/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, agentName: "action-building" }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setActionSessions((prev) =>
            prev.map((s) =>
              s.sessionId === tempId
                ? { ...s, status: "error" as const, errorMessage: data.error || "Failed to start action creation" }
                : s,
            ),
          );
          return;
        }

        const { sessionId } = await response.json();
        session.sessionId = sessionId;
        addStoredSession(session);

        // Update placeholder with real sessionId
        setActionSessions((prev) =>
          prev.map((s) =>
            s.sessionId === tempId
              ? { ...s, sessionId, status: "building" as const }
              : s,
          ),
        );

        pollSession(session);
      } catch {
        setActionSessions((prev) =>
          prev.map((s) =>
            s.sessionId === tempId
              ? { ...s, status: "error" as const, errorMessage: "Failed to start action creation" }
              : s,
          ),
        );
      }
    },
    [pollSession, setActionSessions],
  );

  // On mount, check for active sessions and resume polling
  useEffect(() => {
    const stored = getStoredSessions();
    if (stored.length === 0) return;

    async function checkAndResume(session: StoredSession) {
      // For add-action sessions with required fields, show inline placeholder immediately
      const isAddAction =
        session.type === "add-action" && session.serviceId && session.description;
      const isBuildIntegration = session.type === "build-integration";

      if (isAddAction) {
        setActionSessions((prev) => {
          if (prev.some((s) => s.sessionId === session.sessionId)) return prev;
          return [
            ...prev,
            {
              sessionId: session.sessionId,
              serviceId: session.serviceId,
              description: session.description,
              status: "building" as const,
            },
          ];
        });
      }

      if (isBuildIntegration) {
        setBuildSessions((prev) => {
          if (prev.some((s) => s.sessionId === session.sessionId)) return prev;
          return [
            ...prev,
            {
              sessionId: session.sessionId,
              placeholderServiceId: session.placeholderServiceId,
              appName: session.appName,
              status: "building" as const,
            },
          ];
        });
      }

      try {
        const response = await fetch(
          `/api/membrane/sessions?sessionId=${session.sessionId}`,
        );
        if (!response.ok) {
          removeStoredSession(session.sessionId);
          if (isAddAction) {
            setActionSessions((prev) =>
              prev.filter((s) => s.sessionId !== session.sessionId),
            );
          }
          if (isBuildIntegration) {
            setBuildSessions((prev) =>
              prev.filter((s) => s.sessionId !== session.sessionId),
            );
          }
          return;
        }
        const data: SessionStatus = await response.json();

        if (data.status === "completed" || data.state === "idle") {
          removeStoredSession(session.sessionId);
          if (session.type === "build-integration") {
            await addBuiltService(session.sessionId, session.appName, session.placeholderServiceId);
            const services = await refetchIntegrations();
            setMembraneServices(services);
            setBuildSessions((prev) =>
              prev.map((s) =>
                s.sessionId === session.sessionId
                  ? { ...s, status: "success" as const }
                  : s,
              ),
            );
            setTimeout(() => {
              setBuildSessions((prev) =>
                prev.filter((s) => s.sessionId !== session.sessionId),
              );
            }, 2000);
          } else {
            setActionsRefetch((c) => c + 1);
            if (isAddAction) {
              setActionSessions((prev) =>
                prev.map((s) =>
                  s.sessionId === session.sessionId
                    ? { ...s, status: "success" as const }
                    : s,
                ),
              );
              setTimeout(() => {
                setActionSessions((prev) =>
                  prev.filter((s) => s.sessionId !== session.sessionId),
                );
              }, 2000);
            }
          }
          return;
        }
        if (data.status === "failed" || data.status === "cancelled" || data.status === "stopped") {
          removeStoredSession(session.sessionId);
          if (isAddAction) {
            setActionSessions((prev) =>
              prev.map((s) =>
                s.sessionId === session.sessionId
                  ? { ...s, status: "error" as const, errorMessage: getFailureMessage(session, data.status) }
                  : s,
              ),
            );
          }
          if (isBuildIntegration) {
            if (session.type === "build-integration") {
              await deletePlaceholderService(session.placeholderServiceId);
              const services = await refetchIntegrations();
              setMembraneServices(services);
            }
            setBuildSessions((prev) =>
              prev.map((s) =>
                s.sessionId === session.sessionId
                  ? { ...s, status: "error" as const, errorMessage: getFailureMessage(session, data.status) }
                  : s,
              ),
            );
          }
          return;
        }

        // Still running — resume polling
        pollSession(session);
      } catch {
        removeStoredSession(session.sessionId);
        if (isAddAction) {
          setActionSessions((prev) =>
            prev.filter((s) => s.sessionId !== session.sessionId),
          );
        }
        if (isBuildIntegration) {
          setBuildSessions((prev) =>
            prev.filter((s) => s.sessionId !== session.sessionId),
          );
        }
      }
    }

    stored.forEach(checkAndResume);
  }, [pollSession, setMembraneServices, setActionSessions, setBuildSessions]);

  return { startBuildSession, startAddActionSession, isBuilding };
}

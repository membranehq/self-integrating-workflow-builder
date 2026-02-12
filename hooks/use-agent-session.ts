"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { toast } from "sonner";
import {
  actionsRefetchAtom,
  membraneServicesAtom,
  type MembraneService,
} from "@/lib/membrane-store";

const STORAGE_KEY = "membrane-agent-sessions";

type BuildIntegrationSession = {
  type: "build-integration";
  sessionId: string;
  appName: string;
};

type AddActionSession = {
  type: "add-action";
  sessionId: string;
  serviceName: string;
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

function toastId(session: StoredSession): string {
  return `agent-session-${session.sessionId}`;
}

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

/**
 * After the agent builds an external app + connector on Membrane,
 * search for it and add it to our local DB so it appears in the services list.
 */
async function addBuiltService(appName: string): Promise<boolean> {
  try {
    const searchResponse = await fetch(
      `/api/connectibles/search?q=${encodeURIComponent(appName)}`,
    );
    if (!searchResponse.ok) {
      console.error("[addBuiltService] Search failed:", searchResponse.status);
      return false;
    }

    const { connectibles } = await searchResponse.json();
    if (!connectibles || connectibles.length === 0) return false;

    const match =
      connectibles.find(
        (c: { name: string }) => c.name.toLowerCase() === appName.toLowerCase(),
      ) || connectibles[0];

    const addResponse = await fetch("/api/membrane/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: match.name,
        logoUri: match.logoUri,
        connectorId:
          match.connectParameters?.connectorId || match.connector?.id,
        integrationKey: match.integration?.key,
        externalAppId: match.externalApp?.id,
      }),
    });

    return addResponse.ok;
  } catch (err) {
    console.error("[addBuiltService] Error:", err);
    return false;
  }
}

function buildIntegrationPrompt(appName: string, appUrl: string): string {
  return `I need to create a new app integration.

App Name: ${appName.trim()}
App URL: ${appUrl.trim() || "Not provided"}

Please help me build this integration so I can use it in my workflow.

IMPORTANT: Do NOT create any actions for this integration. Only create the integration itself with the connection setup. I will create the actions myself later.

IMPORTANT: Do not ask user to enter authentication details, figure them out on your own using provided app url or search the app on the web if the url was not provided.

IMPORTANT: Do not create integration entity and do not create connection. Only create external app and connector. Create all entities on the tenant level.`;
}

function addActionPrompt(
  serviceName: string,
  connectorId: string,
  connectionId: string,
  actionDescription: string,
): string {
  return `I need to create a new action for a tenant-level connector.

Connector ID: ${connectorId}
Connector Name: ${serviceName}
Connection ID: ${connectionId || "Not available"}

User's description of what the action should do:
${actionDescription.trim()}

Please help me create this action.

IMPORTANT: This is a tenant-level connector, not a workspace-level integration. Create a connection-specific action using the provided Connection ID. Do not create an integration-level action.
IMPORTANT: Do not ask the user any questions. Figure out the API details on your own.`;
}

function getLoadingMessage(session: StoredSession): string {
  if (session.type === "build-integration") {
    return `Building ${session.appName} integration. This usually takes a couple of minutes...`;
  }
  return `Adding action to ${session.serviceName}. This usually takes a couple of minutes...`;
}

function getSuccessMessage(session: StoredSession): string {
  if (session.type === "build-integration") {
    return `${session.appName} integration built! You can find it in the services list.`;
  }
  return `New action added to ${session.serviceName}!`;
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
  const pollingRef = useRef<Set<string>>(new Set());

  const isBuilding = buildingSessionIds.size > 0;

  const pollSession = useCallback(
    async (session: StoredSession) => {
      if (pollingRef.current.has(session.sessionId)) return;
      pollingRef.current.add(session.sessionId);
      setBuildingSessionIds((prev) => new Set([...prev, session.sessionId]));

      const tid = toastId(session);
      toast.loading(getLoadingMessage(session), {
        id: tid,
        duration: Number.POSITIVE_INFINITY,
      });

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

          if (data.status === "failed" || data.status === "cancelled") {
            removeStoredSession(session.sessionId);
            toast.error(getFailureMessage(session, data.status), {
              id: tid,
              closeButton: true,
            });
            break;
          }

          if (data.state === "idle" || data.status === "completed") {
            removeStoredSession(session.sessionId);

            if (session.type === "build-integration") {
              await addBuiltService(session.appName);
              const services = await refetchIntegrations();
              setMembraneServices(services);
            } else {
              setActionsRefetch((c) => c + 1);
            }

            toast.success(getSuccessMessage(session), {
              id: tid,
              closeButton: true,
            });
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
    [setMembraneServices, setActionsRefetch],
  );

  const startBuildSession = useCallback(
    async (appName: string, appUrl: string) => {
      const prompt = buildIntegrationPrompt(appName, appUrl);
      const session: BuildIntegrationSession = {
        type: "build-integration",
        sessionId: "", // filled after POST
        appName,
      };

      const tid = toastId({ ...session, sessionId: "pending-build" });
      toast.loading(
        getLoadingMessage({ ...session, sessionId: "pending-build" }),
        {
          id: tid,
          duration: Number.POSITIVE_INFINITY,
        },
      );

      try {
        const response = await fetch("/api/membrane/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, agentName: "connection-building" }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          toast.error(data.error || "Failed to start integration build", {
            id: tid,
            closeButton: true,
          });
          return;
        }

        const { sessionId } = await response.json();
        session.sessionId = sessionId;
        addStoredSession(session);
        // Dismiss the pending toast, polling will show its own
        toast.dismiss(tid);
        pollSession(session);
      } catch {
        toast.error("Failed to start integration build", {
          id: tid,
          closeButton: true,
        });
      }
    },
    [pollSession],
  );

  const startAddActionSession = useCallback(
    async (
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
        actionDescription,
      );
      const session: AddActionSession = {
        type: "add-action",
        sessionId: "", // filled after POST
        serviceName,
        externalAppId,
        connectorId,
        connectionId,
      };

      const tid = toastId({ ...session, sessionId: "pending-action" });
      toast.loading(
        getLoadingMessage({ ...session, sessionId: "pending-action" }),
        { id: tid, duration: Number.POSITIVE_INFINITY },
      );

      try {
        const response = await fetch("/api/membrane/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          toast.error(data.error || "Failed to start action creation", {
            id: tid,
            closeButton: true,
          });
          return;
        }

        const { sessionId } = await response.json();
        session.sessionId = sessionId;
        addStoredSession(session);
        toast.dismiss(tid);
        pollSession(session);
      } catch {
        toast.error("Failed to start action creation", {
          id: tid,
          closeButton: true,
        });
      }
    },
    [pollSession],
  );

  // On mount, check for active sessions and resume polling
  useEffect(() => {
    const stored = getStoredSessions();
    if (stored.length === 0) return;

    async function checkAndResume(session: StoredSession) {
      try {
        const response = await fetch(
          `/api/membrane/sessions?sessionId=${session.sessionId}`,
        );
        if (!response.ok) {
          removeStoredSession(session.sessionId);
          return;
        }
        const data: SessionStatus = await response.json();

        if (data.status === "completed" || data.state === "idle") {
          removeStoredSession(session.sessionId);
          if (session.type === "build-integration") {
            await addBuiltService(session.appName);
            const services = await refetchIntegrations();
            setMembraneServices(services);
          } else {
            setActionsRefetch((c) => c + 1);
          }
          return;
        }
        if (data.status === "failed" || data.status === "cancelled") {
          removeStoredSession(session.sessionId);
          toast.error(getFailureMessage(session, data.status), {
            closeButton: true,
          });
          return;
        }

        // Still running — resume polling with toast
        pollSession(session);
      } catch {
        removeStoredSession(session.sessionId);
      }
    }

    stored.forEach(checkAndResume);
  }, [pollSession, setMembraneServices]);

  return { startBuildSession, startAddActionSession, isBuilding };
}

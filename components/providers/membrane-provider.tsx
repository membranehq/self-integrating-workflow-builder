"use client";

import { IntegrationAppProvider } from "@membranehq/react";
import { useAgentSession } from "@/hooks/use-agent-session";

const API_URI =
  process.env.NEXT_PUBLIC_INTEGRATION_APP_API_URL ||
  "https://api.integration.app";

const UI_URI =
  process.env.NEXT_PUBLIC_INTEGRATION_APP_UI_URL ||
  "https://ui.integration.app";

async function fetchToken() {
  const response = await fetch("/api/membrane/token");
  if (!response.ok) {
    throw new Error("Failed to fetch Membrane token");
  }
  const data = await response.json();
  return data.token;
}

/** Resumes agent session polling on mount if one is stored in localStorage. */
function AgentSessionResumer() {
  useAgentSession();
  return null;
}

export function MembraneProvider({ children }: { children: React.ReactNode }) {
  return (
    <IntegrationAppProvider
      apiUri={API_URI}
      fetchToken={fetchToken}
      uiUri={UI_URI}
    >
      <AgentSessionResumer />
      {children}
    </IntegrationAppProvider>
  );
}

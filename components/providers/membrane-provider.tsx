"use client";

import { IntegrationAppProvider } from "@membranehq/react";

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

export function MembraneProvider({ children }: { children: React.ReactNode }) {
  return (
    <IntegrationAppProvider
      apiUri={API_URI}
      fetchToken={fetchToken}
      uiUri={UI_URI}
    >
      {children}
    </IntegrationAppProvider>
  );
}

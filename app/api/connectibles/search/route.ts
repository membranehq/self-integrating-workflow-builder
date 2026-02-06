import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateMembraneToken,
  MembraneTokenError,
} from "@/lib/membrane-token";
import type { Connectible } from "@/lib/types/connectible";

const API_URI =
  process.env.NEXT_PUBLIC_INTEGRATION_APP_API_URL ||
  "https://api.integration.app";

interface SearchResult {
  elementType: string;
  element: Record<string, unknown>;
}

async function searchByType(
  token: string,
  elementType: string,
  query: string
): Promise<Record<string, unknown>[]> {
  try {
    const params = new URLSearchParams({ elementType, q: query });
    const response = await fetch(`${API_URI}/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) return [];
    const data: { items?: SearchResult[] } = await response.json();
    return (data.items || []).map((r) => r.element);
  } catch {
    return [];
  }
}

async function listByEndpoint(
  token: string,
  endpoint: string,
  limit: number = 50
): Promise<Record<string, unknown>[]> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(
      `${API_URI}/${endpoint}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) return [];
    const data: { items?: Record<string, unknown>[] } = await response.json();
    return data.items || [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || undefined;

    const token = await generateMembraneToken(
      session.user.id,
      session.user.name
    );

    let integrationElements: Record<string, unknown>[] = [];
    let appElements: Record<string, unknown>[] = [];
    let connectorElements: Record<string, unknown>[] = [];

    if (query) {
      [integrationElements, appElements, connectorElements] =
        await Promise.all([
          searchByType(token, "integration", query),
          searchByType(token, "app", query),
          searchByType(token, "connector", query),
        ]);
    } else {
      [integrationElements, appElements] = await Promise.all([
        listByEndpoint(token, "integrations", 50),
        listByEndpoint(token, "external-apps", 50),
      ]);
    }

    const connectibles: Connectible[] = [];
    const seenKeys = new Set<string>();

    const appById = new Map<string, Record<string, unknown>>();
    const connectorById = new Map<string, Record<string, unknown>>();

    for (const el of appElements) {
      const id = (el.uuid as string) || (el.id as string);
      if (id) appById.set(id, el);
    }
    for (const el of connectorElements) {
      if (el.id) connectorById.set(el.id as string, el);
    }

    // 1. Integrations (highest priority — already set up)
    for (const el of integrationElements) {
      const key = `integration:${el.id}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const connectible: Connectible = {
        name: (el.name as string) || (el.key as string),
        logoUri: el.logoUri as string | undefined,
        connectParameters: { integrationId: el.id as string },
        integration: {
          id: el.id as string,
          key: el.key as string | undefined,
          state: el.state as string | undefined,
          connectorId: el.connectorId as string | undefined,
        },
      };

      if (el.appUuid) {
        const app = appById.get(el.appUuid as string);
        connectible.externalApp = {
          id: el.appUuid as string,
          key: app?.key as string | undefined,
          name: app?.name as string | undefined,
        };
      }

      if (el.connectorId) {
        const connector = connectorById.get(el.connectorId as string);
        connectible.connector = {
          id: el.connectorId as string,
          name: connector?.name as string | undefined,
        };
      }

      connectibles.push(connectible);
    }

    // 2. External apps (can be used to create integrations)
    for (const el of appElements) {
      const appId = (el.uuid as string) || (el.id as string);
      if (!el.defaultConnectorId) continue;

      const hasIntegration = connectibles.some(
        (c) => c.externalApp?.id === appId
      );
      if (hasIntegration) continue;

      const key = `app:${appId}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const connector = connectorById.get(el.defaultConnectorId as string);

      const connectible: Connectible = {
        name: (el.name as string) || (el.key as string),
        logoUri: el.logoUri as string | undefined,
        connectParameters: { connectorId: el.defaultConnectorId as string },
        externalApp: {
          id: appId,
          key: el.key as string | undefined,
          name: el.name as string | undefined,
        },
      };

      if (connector) {
        connectible.connector = {
          id: el.defaultConnectorId as string,
          name: connector.name as string | undefined,
        };
      }

      connectibles.push(connectible);
    }

    // 3. Connectors (fallback)
    for (const el of connectorElements) {
      const connectorId = el.id as string;
      const alreadyPresent = connectibles.some(
        (c) =>
          c.connector?.id === connectorId ||
          c.connectParameters.connectorId === connectorId
      );
      if (alreadyPresent) continue;

      const key = `connector:${connectorId}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      connectibles.push({
        name: (el.name as string) || (el.key as string),
        logoUri: el.logoUri as string | undefined,
        connectParameters: { connectorId },
        connector: { id: connectorId, name: el.name as string | undefined },
      });
    }

    // Sort: integrations first, then alphabetically
    connectibles.sort((a, b) => {
      if (a.integration && !b.integration) return -1;
      if (!a.integration && b.integration) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ connectibles });
  } catch (error) {
    console.error("[Connectibles Search] Error:", error);
    if (error instanceof MembraneTokenError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to search connectibles" },
      { status: 500 }
    );
  }
}

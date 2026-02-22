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
  query: string,
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

interface PaginatedResult {
  items: Record<string, unknown>[];
  cursor?: string;
}

async function listByEndpoint(
  token: string,
  endpoint: string,
  limit: number,
  cursor?: string,
): Promise<PaginatedResult> {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const response = await fetch(
      `${API_URI}/${endpoint}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) return { items: [] };
    const data = await response.json();
    return {
      items: data.items || [],
      cursor: data.cursor || undefined,
    };
  } catch {
    return { items: [] };
  }
}

function buildConnectibles(
  integrationElements: Record<string, unknown>[],
  appElements: Record<string, unknown>[],
  connectorElements: Record<string, unknown>[],
): Connectible[] {
  const connectibles: Connectible[] = [];
  const seenKeys = new Set<string>();

  const appById = new Map<string, Record<string, unknown>>();
  const connectorById = new Map<string, Record<string, unknown>>();

  for (const el of appElements) {
    if (el.uuid) appById.set(el.uuid as string, el);
    if (el.id) appById.set(el.id as string, el);
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
    const appObjectId = el.id as string;
    const appUuid = el.uuid as string | undefined;

    const hasIntegration = connectibles.some(
      (c) =>
        c.externalApp?.id === appObjectId ||
        (appUuid && c.externalApp?.id === appUuid),
    );
    if (hasIntegration) continue;

    const key = `app:${appObjectId}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const connector = el.defaultConnectorId
      ? connectorById.get(el.defaultConnectorId as string)
      : undefined;

    const connectible: Connectible = {
      name: (el.name as string) || (el.key as string),
      logoUri: el.logoUri as string | undefined,
      connectParameters: el.defaultConnectorId
        ? { connectorId: el.defaultConnectorId as string }
        : {},
      externalApp: {
        id: appObjectId,
        key: el.key as string | undefined,
        name: el.name as string | undefined,
        websiteUrl: el.appUri as string | undefined,
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
        c.connectParameters.connectorId === connectorId,
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

  return connectibles;
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
    const cursor = searchParams.get("cursor") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);

    const token = await generateMembraneToken(
      session.user.id,
      session.user.name,
    );

    if (query) {
      // Search mode: fetch all results at once (no pagination)
      const [integrationElements, appElements, connectorElements] =
        await Promise.all([
          searchByType(token, "integration", query),
          searchByType(token, "app", query),
          searchByType(token, "connector", query),
        ]);

      const connectibles = buildConnectibles(
        integrationElements,
        appElements,
        connectorElements,
      );

      // Sort: integrations first, preserve API order within groups
      connectibles.sort((a, b) => {
        if (a.integration && !b.integration) return -1;
        if (!a.integration && b.integration) return 1;
        return 0;
      });

      return NextResponse.json({ connectibles });
    }

    // Browse mode: paginate external-apps, fetch all integrations on first page
    const isFirstPage = !cursor;

    const appsResult = await listByEndpoint(
      token,
      "external-apps",
      limit,
      cursor,
    );

    let integrationElements: Record<string, unknown>[] = [];
    if (isFirstPage) {
      // Only fetch integrations on the first page — they go at the top
      const integrationsResult = await listByEndpoint(
        token,
        "integrations",
        200,
      );
      integrationElements = integrationsResult.items;
    }

    const connectibles = buildConnectibles(
      integrationElements,
      appsResult.items,
      [],
    );

    // On first page, sort integrations to the top
    if (isFirstPage) {
      connectibles.sort((a, b) => {
        if (a.integration && !b.integration) return -1;
        if (!a.integration && b.integration) return 1;
        return 0;
      });
    }

    return NextResponse.json({
      connectibles,
      cursor: appsResult.cursor,
    });
  } catch (error) {
    console.error("[Connectibles Search] Error:", error);
    if (error instanceof MembraneTokenError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to search connectibles" },
      { status: 500 },
    );
  }
}

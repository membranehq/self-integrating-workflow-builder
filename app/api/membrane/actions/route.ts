import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateMembraneToken,
  MembraneTokenError,
} from "@/lib/membrane-token";

const API_URI =
  process.env.NEXT_PUBLIC_INTEGRATION_APP_API_URL ||
  "https://api.integration.app";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const externalAppId = searchParams.get("externalAppId");
    const connectionId = searchParams.get("connectionId");

    if (!externalAppId && !connectionId) {
      return NextResponse.json(
        { error: "externalAppId or connectionId is required" },
        { status: 400 }
      );
    }

    const token = await generateMembraneToken(
      session.user.id,
      session.user.name
    );

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Fetch public actions (by externalAppId) and custom actions (by connectionId)
    // in parallel when both are available, then merge.
    const fetches: Promise<Response>[] = [];
    if (externalAppId) {
      const params = new URLSearchParams({ limit: "100", externalAppId });
      fetches.push(fetch(`${API_URI}/actions?${params.toString()}`, { headers }));
    }
    if (connectionId) {
      const params = new URLSearchParams({ limit: "100", connectionId });
      fetches.push(fetch(`${API_URI}/actions?${params.toString()}`, { headers }));
    }

    const responses = await Promise.all(fetches);
    for (const resp of responses) {
      if (!resp.ok) {
        const text = await resp.text();
        console.error("[Membrane Actions] GET failed:", resp.status, text);
        return NextResponse.json(
          { error: "Failed to fetch actions" },
          { status: resp.status }
        );
      }
    }

    const allData = await Promise.all(responses.map((r) => r.json()));
    const actions: { key: string; name: string; description?: string; inputSchema?: Record<string, unknown>; isPublic: boolean }[] = [];
    for (const data of allData) {
      for (const item of (data.items || []) as Record<string, unknown>[]) {
        if (!item.id) continue;
        actions.push({
          key: item.id as string,
          name: (item.name as string) || (item.id as string) || "",
          description: (item.description as string) || undefined,
          inputSchema: (item.inputSchema as Record<string, unknown>) || undefined,
          isPublic: !!(item.isPublic),
        });
      }
    }

    return NextResponse.json({ actions });
  } catch (error) {
    console.error("[Membrane Actions] Error:", error);
    if (error instanceof MembraneTokenError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to fetch actions" },
      { status: 500 }
    );
  }
}

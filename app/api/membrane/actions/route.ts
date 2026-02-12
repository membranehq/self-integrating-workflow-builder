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

    const params = new URLSearchParams({ limit: "100" });
    if (connectionId) {
      params.set("connectionId", connectionId);
    } else if (externalAppId) {
      params.set("externalAppId", externalAppId);
    }

    const response = await fetch(`${API_URI}/actions?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[Membrane Actions] GET failed:", response.status, text);
      return NextResponse.json(
        { error: "Failed to fetch actions" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const items = data.items || [];

    const actions = items
      .filter((item: Record<string, unknown>) => item.id)
      .map((item: Record<string, unknown>) => ({
        key: item.id as string,
        name: (item.name as string) || (item.id as string) || "",
        description: (item.description as string) || undefined,
        inputSchema: (item.inputSchema as Record<string, unknown>) || undefined,
      }));

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

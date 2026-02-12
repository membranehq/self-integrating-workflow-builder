import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateMembraneToken,
  MembraneTokenError,
} from "@/lib/membrane-token";

const API_URI =
  process.env.NEXT_PUBLIC_INTEGRATION_APP_API_URL ||
  "https://api.integration.app";

/**
 * POST /api/membrane/sessions
 * Creates a new Membrane agent session.
 * Body: { prompt: string }
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, agentName } = await request.json();
    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 },
      );
    }

    const token = await generateMembraneToken(
      session.user.id,
      session.user.name,
    );

    const body: Record<string, string> = { prompt };
    if (agentName) {
      body.agentName = agentName;
    }

    const response = await fetch(`${API_URI}/agent/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        "[Membrane Sessions] Failed to create session:",
        response.status,
        text,
      );
      return NextResponse.json(
        { error: `Failed to create agent session: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json({ sessionId: data.id });
  } catch (error) {
    console.error("[Membrane Sessions] POST error:", error);
    if (error instanceof MembraneTokenError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to create agent session" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/membrane/sessions?sessionId=X&wait=1&timeout=50
 * Polls session status via long polling.
 * Returns: { status, state, error, summary }
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const wait = searchParams.get("wait");
    const timeout = searchParams.get("timeout");

    const token = await generateMembraneToken(
      session.user.id,
      session.user.name,
    );

    const url = new URL(`${API_URI}/agent/sessions/${sessionId}`);
    if (wait) url.searchParams.set("wait", wait);
    if (timeout) url.searchParams.set("timeout", timeout);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        "[Membrane Sessions] Failed to poll session:",
        response.status,
        text,
      );
      return NextResponse.json(
        { error: `Failed to poll session: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      status: data.status,
      state: data.state,
      error: data.error,
      summary: data.summary,
    });
  } catch (error) {
    console.error("[Membrane Sessions] GET error:", error);
    if (error instanceof MembraneTokenError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to poll session status" },
      { status: 500 },
    );
  }
}

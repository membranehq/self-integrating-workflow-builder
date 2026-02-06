import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { IntegrationAppClient } from "@membranehq/sdk";
import { db } from "@/lib/db";
import { membraneServices, users } from "@/lib/db/schema";
import {
  generateMembraneToken,
  MembraneTokenError,
} from "@/lib/membrane-token";

const API_URI =
  process.env.NEXT_PUBLIC_INTEGRATION_APP_API_URL ||
  "https://api.integration.app";

/**
 * POST /api/membrane/actions/run
 * Executes a Membrane action server-side via the SDK.
 * Called internally by the workflow executor's membrane-action step.
 *
 * Body: { serviceId, actionKey, input }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { serviceId, actionKey, input } = body;

    if (!serviceId || !actionKey) {
      return NextResponse.json(
        { error: "serviceId and actionKey are required" },
        { status: 400 }
      );
    }

    // Look up the membrane service
    const service = await db.query.membraneServices.findFirst({
      where: eq(membraneServices.id, serviceId),
    });

    if (!service) {
      return NextResponse.json(
        { error: `Membrane service not found: ${serviceId}` },
        { status: 404 }
      );
    }

    if (!service.connectionId) {
      return NextResponse.json(
        {
          error: `No connection established for ${service.name}. Please connect your account first.`,
        },
        { status: 400 }
      );
    }

    // Look up the user for the token
    const user = await db.query.users.findFirst({
      where: eq(users.id, service.userId),
    });

    // Generate JWT token
    let token: string;
    try {
      token = await generateMembraneToken(
        service.userId,
        user?.name || undefined
      );
    } catch (error) {
      if (error instanceof MembraneTokenError) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json(
        { error: "Failed to generate Membrane token" },
        { status: 500 }
      );
    }

    // Create SDK client and run the action
    const client = new IntegrationAppClient({ token, apiUri: API_URI });

    const result = await client
      .action(actionKey)
      .run(input || {}, { connectionId: service.connectionId });

    return NextResponse.json({
      success: true,
      output: result.output ?? result,
    });
  } catch (error) {
    console.error("[Membrane Action Run] Error:", error);
    const message =
      error instanceof Error ? error.message : "Membrane action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

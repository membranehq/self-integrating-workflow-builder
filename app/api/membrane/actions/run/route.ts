import { NextResponse } from "next/server";
import { runMembraneActionDirect } from "@/lib/membrane-action-runner";

/**
 * POST /api/membrane/actions/run
 * Executes a Membrane action server-side via the SDK.
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

    const result = await runMembraneActionDirect(
      serviceId,
      actionKey,
      input || {}
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      output: result.data,
    });
  } catch (error) {
    console.error("[Membrane Action Run] Error:", error);
    const message =
      error instanceof Error ? error.message : "Membrane action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

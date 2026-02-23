import "server-only";

import { eq } from "drizzle-orm";
import { IntegrationAppClient } from "@membranehq/sdk";
import { db } from "@/lib/db";
import { membraneServices, users } from "@/lib/db/schema";
import { generateMembraneToken } from "@/lib/membrane-token";

const API_URI =
  process.env.NEXT_PUBLIC_INTEGRATION_APP_API_URL ||
  "https://api.integration.app";

/**
 * Runs a Membrane action directly (no HTTP round-trip).
 * Used by both the API route and the workflow step.
 */
export async function runMembraneActionDirect(
  serviceId: string,
  actionKey: string,
  input: Record<string, unknown>
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  const service = await db.query.membraneServices.findFirst({
    where: eq(membraneServices.id, serviceId),
  });

  if (!service) {
    return { success: false, error: `Membrane service not found: ${serviceId}` };
  }

  if (!service.connectionId) {
    return {
      success: false,
      error: `No connection established for ${service.name}. Please connect your account first.`,
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, service.userId),
  });

  const token = await generateMembraneToken(
    service.userId,
    user?.name || undefined,
    user?.email || undefined
  );

  const client = new IntegrationAppClient({ token, apiUri: API_URI });

  const result = await client
    .action(actionKey)
    .run(input || {}, { connectionId: service.connectionId });

  return { success: true, data: result.output ?? result };
}

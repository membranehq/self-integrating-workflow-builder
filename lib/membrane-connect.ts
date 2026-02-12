import type { IntegrationAppClient } from "@membranehq/sdk";

/**
 * Opens Membrane's connection UI for a given connector.
 * Uses the SDK's ui.connect() which handles iframe/OAuth flows internally.
 */
export async function openMembraneConnection(
  integrationApp: IntegrationAppClient,
  connectorId: string
): Promise<{ connectionId: string } | null> {
  const connection = await integrationApp.ui.connect({ connectorId });

  if (connection?.id) {
    return { connectionId: connection.id };
  }

  return null;
}

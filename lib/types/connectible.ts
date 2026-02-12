/**
 * Connectible entity - represents something the user can connect to.
 * Unifies integrations, apps, and connectors from the Membrane API
 * into a single searchable type.
 */
export interface Connectible {
  name: string;
  logoUri?: string;
  connectParameters: {
    integrationId?: string;
    connectorId?: string;
  };
  integration?: {
    id: string;
    key?: string;
    state?: string;
    connectorId?: string;
  };
  externalApp?: {
    id: string;
    key?: string;
    name?: string;
  };
  connector?: {
    id: string;
    name?: string;
  };
}

import { atom } from "jotai";

export type MembraneService = {
  id: string;
  name: string;
  logoUri?: string;
  connectorId?: string;
  integrationKey?: string;
  externalAppId?: string;
  connectionId?: string;
};

export const membraneServicesAtom = atom<MembraneService[]>([]);

/** Incremented when an agent session adds a new action, triggering action list refetch */
export const actionsRefetchAtom = atom(0);

export type ActionSessionStatus = "pending" | "building" | "success" | "error";

export type ActionSessionEntry = {
  sessionId: string;
  serviceId: string;
  description: string;
  status: ActionSessionStatus;
  errorMessage?: string;
};

/** Active add-action agent sessions shown as inline placeholders in the action list */
export const actionSessionsAtom = atom<ActionSessionEntry[]>([]);

export type BuildSessionEntry = {
  sessionId: string;
  placeholderServiceId?: string;
  appName: string;
  status: ActionSessionStatus;
  errorMessage?: string;
};

/** Active build-integration agent sessions shown inline on placeholder services */
export const buildSessionsAtom = atom<BuildSessionEntry[]>([]);

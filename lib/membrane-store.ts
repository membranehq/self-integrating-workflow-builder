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

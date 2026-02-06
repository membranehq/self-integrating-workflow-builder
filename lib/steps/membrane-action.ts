/**
 * Executable step function for Membrane actions.
 *
 * Calls the /api/membrane/actions/run API route to execute the action.
 * This avoids importing the Membrane SDK (which uses axios/Node.js modules)
 * into the workflow bundle where Node.js modules are not allowed.
 */
import "server-only";

import { getErrorMessage } from "../utils";
import { type StepInput, withStepLogging } from "./step-handler";

type MembraneActionResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

export type MembraneActionInput = StepInput & {
  /** The full action type, e.g. "membrane:{serviceId}:{actionKey}" */
  actionType: string;
  /** Config values from the node, including membraneInput.* fields */
  [key: string]: unknown;
};

/**
 * Extract membraneInput.* fields from the config into a flat input object.
 */
function extractMembraneInput(
  config: Record<string, unknown>
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith("membraneInput.")) {
      const fieldKey = key.slice("membraneInput.".length);
      input[fieldKey] = value;
    }
  }
  return input;
}

/**
 * Core logic: parse the action type and call the API route.
 */
async function runMembraneAction(
  input: MembraneActionInput
): Promise<MembraneActionResult> {
  const { actionType } = input;

  // Parse serviceId and actionKey from "membrane:{serviceId}:{actionKey}"
  const rest = actionType.slice("membrane:".length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx < 0) {
    return {
      success: false,
      error: "Invalid Membrane action type: missing action key",
    };
  }
  const serviceId = rest.slice(0, colonIdx);
  const actionKey = rest.slice(colonIdx + 1);

  // Build the input from membraneInput.* fields
  const actionInput = extractMembraneInput(input);

  try {
    // Call the API route which handles SDK/DB/token internally
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `http://localhost:${process.env.PORT || 3000}`;
    const response = await fetch(`${baseUrl}/api/membrane/actions/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, actionKey, input: actionInput }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return {
        success: false,
        error: data.error || `Membrane action failed (${response.status})`,
      };
    }

    return { success: true, data: data.output };
  } catch (error) {
    return {
      success: false,
      error: `Membrane action failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Membrane Action Step
 * Executes an action via the Membrane/integration.app API route.
 */
export async function membraneActionStep(
  input: MembraneActionInput
): Promise<MembraneActionResult> {
  "use step";
  return withStepLogging(input, () => runMembraneAction(input));
}
membraneActionStep.maxRetries = 0;

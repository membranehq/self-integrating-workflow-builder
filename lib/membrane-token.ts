import { SignJWT } from "jose";

export class MembraneTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembraneTokenError";
  }
}

export async function generateMembraneToken(
  userId: string,
  userName?: string
): Promise<string> {
  const workspaceKey = process.env.MEMBRANE_WORKSPACE_KEY;
  const workspaceSecret = process.env.MEMBRANE_WORKSPACE_SECRET;

  if (!workspaceKey || !workspaceSecret) {
    throw new MembraneTokenError(
      "Membrane workspace credentials not configured"
    );
  }

  const secret = new TextEncoder().encode(workspaceSecret);

  return new SignJWT({
    id: userId,
    name: userName || userId,
    isAdmin: 0,
  })
    .setProtectedHeader({ alg: "HS512" })
    .setIssuer(workspaceKey)
    .setExpirationTime("2h")
    .sign(secret);
}

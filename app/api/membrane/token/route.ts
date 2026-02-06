import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateMembraneToken,
  MembraneTokenError,
} from "@/lib/membrane-token";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await generateMembraneToken(
      session.user.id,
      session.user.name
    );

    return NextResponse.json({ token });
  } catch (error) {
    console.error("[Membrane Token] Error:", error);
    if (error instanceof MembraneTokenError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}

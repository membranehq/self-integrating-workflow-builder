import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { membraneServices } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const services = await db
      .select()
      .from(membraneServices)
      .where(eq(membraneServices.userId, session.user.id));

    return NextResponse.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        logoUri: s.logoUri,
        connectorId: s.connectorId,
        integrationKey: s.integrationKey,
        externalAppId: s.externalAppId,
        connectionId: s.connectionId,
      })),
    });
  } catch (error) {
    console.error("[Membrane Services] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch services" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, logoUri, connectorId, integrationKey, externalAppId } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(membraneServices)
      .values({
        userId: session.user.id,
        name,
        logoUri: logoUri || null,
        connectorId: connectorId || null,
        integrationKey: integrationKey || null,
        externalAppId: externalAppId || null,
      })
      .returning();

    return NextResponse.json({
      service: {
        id: created.id,
        name: created.name,
        logoUri: created.logoUri,
        connectorId: created.connectorId,
        integrationKey: created.integrationKey,
        externalAppId: created.externalAppId,
        connectionId: created.connectionId,
      },
    });
  } catch (error) {
    console.error("[Membrane Services] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create service" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, connectionId } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(membraneServices)
      .set({ connectionId: connectionId || null })
      .where(
        and(
          eq(membraneServices.id, id),
          eq(membraneServices.userId, session.user.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Service not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      service: {
        id: updated.id,
        name: updated.name,
        logoUri: updated.logoUri,
        connectorId: updated.connectorId,
        integrationKey: updated.integrationKey,
        externalAppId: updated.externalAppId,
        connectionId: updated.connectionId,
      },
    });
  } catch (error) {
    console.error("[Membrane Services] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update service" },
      { status: 500 }
    );
  }
}

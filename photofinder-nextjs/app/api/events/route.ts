import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(events)
  } catch (error) {
    console.error("GET /api/events error:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await request.json()

    // Validate required fields (Prisma requires name, slug, date)
    if (!body.name || !body.date || !body.slug) {
      return NextResponse.json({ error: "Missing required fields: name, slug, and date" }, { status: 400 })
    }

    const eventData = {
      name: body.name,
      slug: body.slug,
      date: new Date(body.date),
      location: body.location || null,
      description: body.description || null,
      status: body.status || 'DRAFT',
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    };

    let newEvent;
    try {
      newEvent = await prisma.event.create({ data: eventData });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "";

      // Fallback for stale Prisma runtime that still validates against an older Event shape.
      if (message.includes("Unknown argument `expiresAt`")) {
        const rows = await prisma.$queryRaw<any[]>`
          INSERT INTO "events" ("name", "slug", "date", "location", "description", "status", "expiresAt")
          VALUES (${eventData.name}, ${eventData.slug}, ${eventData.date}, ${eventData.location}, ${eventData.description}, ${eventData.status}::"EventStatus", ${eventData.expiresAt})
          RETURNING *
        `;
        newEvent = rows[0];
      } else {
        throw createError;
      }
    }

    return NextResponse.json(newEvent, { status: 201 })
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}

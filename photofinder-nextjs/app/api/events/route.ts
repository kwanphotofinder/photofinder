import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
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
    const body = await request.json()

    // Validate required fields (Prisma requires name, slug, date)
    if (!body.name || !body.date || !body.slug) {
      return NextResponse.json({ error: "Missing required fields: name, slug, and date" }, { status: 400 })
    }

    const newEvent = await prisma.event.create({
      data: {
        name: body.name,
        slug: body.slug,
        date: new Date(body.date),
        location: body.location || null,
        description: body.description || null,
        status: body.status || 'DRAFT',
      }
    });

    return NextResponse.json(newEvent, { status: 201 })
  } catch (error) {
    console.error("POST /api/events error:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}

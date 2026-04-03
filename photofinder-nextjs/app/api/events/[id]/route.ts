import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { deleteFromCloudinary } from "@/lib/cloudinary"

// Get single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // In Next 15, route params must be awaited
) {
  try {
    const p = await params;
    const event = await prisma.event.findUnique({
      where: { id: p.id },
      include: {
        photos: true, // You may or may not want to include photos, adjust as needed
      }
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error("GET /api/events/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 })
  }
}

// Update single event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const body = await request.json()

    // Filter out fields that shouldn't be patched or transform as needed
    const dataToUpdate: any = {};
    if (body.name !== undefined) dataToUpdate.name = body.name;
    if (body.slug !== undefined) dataToUpdate.slug = body.slug;
    if (body.date !== undefined) dataToUpdate.date = new Date(body.date);
    if (body.location !== undefined) dataToUpdate.location = body.location;
    if (body.description !== undefined) dataToUpdate.description = body.description;
    if (body.status !== undefined) dataToUpdate.status = body.status;

    const updatedEvent = await prisma.event.update({
      where: { id: p.id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedEvent)
  } catch (error) {
    console.error("PATCH /api/events/[id] error:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  }
}

// Delete single event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    
    // 1. Fetch photos to safely delete them from storage before removing event
    // This allows you to delete from Cloudinary too.
    const photos = await prisma.photo.findMany({
      where: { eventId: p.id },
    });

    // Delete from Cloudinary
    for (const photo of photos) {
      await deleteFromCloudinary(photo.storageUrl); 
    }

    // 2. Since we delete the event and its relations, we use transaction or Prisma's onDelete: cascade
    // Assuming onDelete: cascade isn't in your schema yet, we manually delete photos first
    await prisma.photo.deleteMany({
      where: { eventId: p.id }
    });

    // 3. Delete the event
    await prisma.event.delete({
      where: { id: p.id },
    });

    return NextResponse.json({ message: "Event deleted successfully" })
  } catch (error) {
    console.error("DELETE /api/events/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
}

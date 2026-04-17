import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const thresholdParam = Number(req.nextUrl.searchParams.get("threshold") ?? "0.55");
    const threshold = Number.isFinite(thresholdParam) && thresholdParam > 0 && thresholdParam <= 1
      ? thresholdParam
      : 0.55;

    const photos = await prisma.photo.findMany({
      where: {
        faces: {
          some: {
            confidence: {
              lt: threshold,
            },
          },
        },
      },
      include: {
        event: true,
        faces: {
          select: {
            confidence: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    });

    const queue = photos.map((photo) => {
      const confidenceValues = photo.faces
        .map((face) => face.confidence)
        .filter((value): value is number => typeof value === "number");

      const lowConfidenceValues = confidenceValues.filter((value) => value < threshold);
      const minConfidence = confidenceValues.length > 0 ? Math.min(...confidenceValues) : null;

      return {
        id: photo.id,
        eventId: photo.eventId,
        eventName: photo.event?.name || "Unknown Event",
        storageUrl: photo.storageUrl,
        thumbnailUrl: photo.thumbnailUrl,
        processingStatus: photo.processingStatus,
        createdAt: photo.createdAt,
        lowConfidenceFaces: lowConfidenceValues.length,
        totalFaces: confidenceValues.length,
        minConfidence,
      };
    });

    return NextResponse.json({
      threshold,
      total: queue.length,
      items: queue,
    });
  } catch (error) {
    console.error("GET /api/admin/low-confidence error:", error);
    return NextResponse.json({ error: "Failed to fetch low-confidence queue" }, { status: 500 });
  }
}
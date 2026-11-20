import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { getSystemSetting } from "@/lib/system-settings";

async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    if (!user) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Default comes from the admin-set Low-Confidence Review Threshold (stored as a whole
    // percent, e.g. 65). A per-request ?threshold= (0-1) still overrides it.
    let defaultThreshold = 0.65;
    try {
      const pct = await getSystemSetting("low_confidence_threshold");
      if (Number.isFinite(pct) && pct > 0) {
        defaultThreshold = Math.min(1, Math.max(0, pct / 100));
      }
    } catch {
      defaultThreshold = 0.65;
    }
    const rawThreshold = req.nextUrl.searchParams.get("threshold");
    const thresholdParam = rawThreshold !== null ? Number(rawThreshold) : defaultThreshold;
    const threshold = Number.isFinite(thresholdParam) && thresholdParam > 0 && thresholdParam <= 1
      ? thresholdParam
      : defaultThreshold;

    const photos = await prisma.photo.findMany({
      where: {
        lowConfidenceDismissedAt: null,
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

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdmin(req);
    if (!user) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const photoId = typeof body?.photoId === "string" ? body.photoId : "";

    if (!photoId) {
      return NextResponse.json({ error: "photoId is required" }, { status: 400 });
    }

    await prisma.photo.update({
      where: { id: photoId },
      data: {
        lowConfidenceDismissedAt: new Date(),
        lowConfidenceDismissedBy: user.sub,
      },
    });

    return NextResponse.json({ status: "success", photoId });
  } catch (error) {
    console.error("PATCH /api/admin/low-confidence error:", error);
    return NextResponse.json({ error: "Failed to dismiss low-confidence photo" }, { status: 500 });
  }
}

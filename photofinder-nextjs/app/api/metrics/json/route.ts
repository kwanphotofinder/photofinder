import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Calculate the average confidence from all rows in the Face table
    const aggregate = await prisma.face.aggregate({
      _avg: {
        confidence: true,
      },
    });

    const averageConfidence = aggregate._avg.confidence || 0;

    // Return the exact Prometheus-style JSON shape the frontend expects
    return NextResponse.json([
      {
        name: "ai_confidence_score",
        help: "Average confidence score of AI face detections",
        type: "gauge",
        values: [
          {
            value: averageConfidence,
            labels: {},
          },
        ],
      },
    ]);
  } catch (error) {
    console.error("GET /api/metrics/json error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const LOW_CONFIDENCE_THRESHOLD = 0.65;

    const photos = await prisma.photo.findMany({
      where: {
        OR: [
          {
            lowConfidenceDismissedAt: {
              not: null,
            },
          },
          {
            faces: {
              none: {
                confidence: {
                  lt: LOW_CONFIDENCE_THRESHOLD,
                },
              },
            },
          },
        ],
      },
      include: { event: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(photos);
  } catch (error) {
    console.error('GET /api/photos error:', error);
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }
}

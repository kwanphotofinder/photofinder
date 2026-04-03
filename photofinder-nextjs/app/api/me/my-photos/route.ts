import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    // In production, uncomment the auth guard
    // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Mock header fallback for dev
    const uploaderId = user?.sub || req.headers.get('user-id');

    if (!uploaderId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }

    const myPhotos = await prisma.photo.findMany({
      where: { uploaderId },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(myPhotos);
  } catch (error) {
    console.error('GET /api/me/my-photos error:', error);
    return NextResponse.json({ error: 'Failed to fetch your photos' }, { status: 500 });
  }
}

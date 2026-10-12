import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getPhotoEngagementSummaries } from '@/lib/photo-engagement';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const p = await params;
    const user = await getUserFromRequest(req);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.sub !== p.userId && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: You can only view your own saved photos' }, { status: 403 });
    }

    const savedPhotos = await prisma.savedPhoto.findMany({
      where: { userId: p.userId },
      include: {
        photo: {
          include: { event: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const stats = await getPhotoEngagementSummaries(savedPhotos.map((savedPhoto) => savedPhoto.photo.id));
    const response = savedPhotos.map((savedPhoto) => ({
      ...savedPhoto,
      stats: stats.get(savedPhoto.photo.id) ?? {
        views: 0,
        shares: 0,
        likes: 0,
        downloads: 0,
      },
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Saved Photos GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch saved photos' }, { status: 500 });
  }
}

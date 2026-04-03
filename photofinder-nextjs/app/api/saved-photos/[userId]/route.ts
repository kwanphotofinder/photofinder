import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const p = await params;
    const user = await getUserFromRequest(req);
    
    // Authorization check
    // if (!user || user.sub !== p.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const savedPhotos = await prisma.savedPhoto.findMany({
      where: { userId: p.userId },
      include: {
        photo: {
          include: { event: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(savedPhotos);
  } catch (error) {
    console.error('Saved Photos GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch saved photos' }, { status: 500 });
  }
}

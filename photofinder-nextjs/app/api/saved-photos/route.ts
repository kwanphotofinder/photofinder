import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const userId = user.sub;
    const { photoId } = body;
    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID required' }, { status: 400 });
    }

    const savedPhoto = await prisma.savedPhoto.create({
      data: {
        userId,
        photoId,
      },
    });

    return NextResponse.json(savedPhoto, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Photo already saved by this user' }, { status: 409 });
    }
    console.error('Saved Photo POST error:', error);
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 });
  }
}

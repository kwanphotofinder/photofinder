import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const body = await req.json();
    
    // Support either proper JWT or the old custom header ('user-id')
    const userId = user?.sub || req.headers.get('user-id');
    const { photoId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 401 });
    }
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

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; photoId: string }> }
) {
  try {
    const p = await params;
    const user = await getUserFromRequest(req);
    
    // Auth guard (optional)
    // if (!user || user.sub !== p.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.savedPhoto.delete({
      where: {
        userId_photoId: {
          userId: p.userId,
          photoId: p.photoId,
        },
      },
    });

    return NextResponse.json({ message: 'Photo unsaved successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
       return NextResponse.json({ error: 'Saved photo not found' }, { status: 404 });
    }
    console.error('DELETE /api/saved-photos/[userId]/[photoId] error:', error);
    return NextResponse.json({ error: 'Failed to unsave photo' }, { status: 500 });
  }
}

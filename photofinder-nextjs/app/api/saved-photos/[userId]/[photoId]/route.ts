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
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only allow the owner of the saved photo or admins to delete it
    if (user.sub !== p.userId && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: You can only remove your own saved photos' }, { status: 403 });
    }

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

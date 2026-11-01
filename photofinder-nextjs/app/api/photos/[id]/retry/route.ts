import { NextRequest, NextResponse } from 'next/server';
import { aiQueue } from '@/lib/ai-queue';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const maxDuration = 180;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'PHOTOGRAPHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const photo = await prisma.photo.findUnique({
      where: { id },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    
    // We only allow retrying failed photos to prevent duplicate embeddings
    if (photo.processingStatus !== 'FAILED') {
      return NextResponse.json({ error: 'Only FAILED photos can be retried' }, { status: 400 });
    }

    // Update status to PENDING and enqueue into AI processing queue
    const updatedPhoto = await prisma.photo.update({
      where: { id },
      data: { processingStatus: 'PENDING' }
    });

    await aiQueue.enqueue({
      photoId: photo.id,
      storageUrl: photo.storageUrl,
      retries: 0,
    }, "HIGH");

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
      message: 'Photo re-enqueued for AI processing',
    });

  } catch (error) {
    console.error('Retry route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

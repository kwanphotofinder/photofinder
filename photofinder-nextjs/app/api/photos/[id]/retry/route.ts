import { NextRequest, NextResponse } from 'next/server';
import { extractFaces } from '@/lib/ai';
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

    // Update status to PROCESSING to prevent concurrent retries
    await prisma.photo.update({
      where: { id },
      data: { processingStatus: 'PROCESSING' }
    });

    try {
      // 1. Fetch the image from Cloudinary
      // (This will be the optimized 2048px WebP image, which is perfectly fine for AI retry)
      const res = await fetch(photo.storageUrl);
      if (!res.ok) throw new Error('Failed to download image from storage');
      
      const arrayBuffer = await res.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      // 2. Extract faces via AI
      const filename = photo.storageUrl.split('/').pop() || 'retry.jpg';
      const faces = await extractFaces(fileBuffer, filename);

      // 3. Save faces in DB
      for (const face of faces) {
        const vectorString = `[${face.embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(`
          INSERT INTO "faces" ("id", "photoId", "confidence", "x", "y", "w", "h", "embedding")
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::vector)
        `,
          photo.id,
          face.det_score,
          face.bbox[0],
          face.bbox[1],
          face.bbox[2],
          face.bbox[3],
          vectorString
        );
      }

      // 4. Mark as completed
      const updatedPhoto = await prisma.photo.update({
        where: { id },
        data: { processingStatus: 'COMPLETED' }
      });

      return NextResponse.json(updatedPhoto);
    } catch (processError) {
      console.error('Retry processing error:', processError);
      
      // Revert status to FAILED
      await prisma.photo.update({
        where: { id },
        data: { processingStatus: 'FAILED' }
      });
      
      return NextResponse.json({ error: 'AI processing failed again' }, { status: 500 });
    }

  } catch (error) {
    console.error('Retry route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { extractFaces } from '@/lib/ai';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { optimizeForStorage } from '@/lib/image';

// Allow Vercel Hobby tier to wait up to 180 seconds for Hugging Face AI to wake up
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'PHOTOGRAPHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;
    const uploaderId = user?.sub || (formData.get('uploaderId') as string | undefined);

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 413 });
    }
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 1. Optimize image for storage (resize to 2048px + WebP quality 85)
    const optimized = await optimizeForStorage(fileBuffer);

    // 2. Upload the OPTIMIZED version to Cloudinary (saves ~70-80% storage)
    const storageUrl = await uploadToCloudinary(file.name, 'image/webp', optimized.buffer, eventId);

    // 3. Create Photo Record in Prisma (dimensions from the optimized version)
    const photo = await prisma.photo.create({
      data: {
        eventId,
        uploaderId,
        storageUrl,
        mimeType: 'image/webp',
        processingStatus: 'PROCESSING',
        width: optimized.width,
        height: optimized.height,
      },
    });

    try {
      // 4. Send buffer to AI Service to get Face Embeddings and Bounding Boxes
      const faces = await extractFaces(fileBuffer, file.name);

      // 5. Save each face's pgvector embedding into PostgreSQL natively
      for (const face of faces) {
        // Construct pgvector syntax: '[1.0, 2.0, ...]'
        const vectorString = `[${face.embedding.join(',')}]`;

        // We use executeRaw to safely cast pgvector data into the Unsupported type
         await prisma.$executeRawUnsafe(`
          INSERT INTO "faces" ("id", "photoId", "confidence", "x", "y", "w", "h", "embedding")
          VALUES (
            gen_random_uuid(), 
            $1, 
            $2, 
            $3, 
            $4, 
            $5, 
            $6, 
            $7::vector
          )
        `, 
          photo.id, 
          face.det_score, 
          face.bbox[0], 
          face.bbox[1], 
          face.bbox[2] - face.bbox[0], 
          face.bbox[3] - face.bbox[1], 
          vectorString
        );
      }

      // 6. Complete Photo processing status
      await prisma.photo.update({
        where: { id: photo.id },
        data: { processingStatus: 'COMPLETED' },
      });

      return NextResponse.json({
        photoId: photo.id,
        storageUrl,
        facesDetected: faces.length,
        status: 'success',
      }, { status: 201 });

    } catch (error) {
      console.error(`AI or DB failure for photo ${photo.id}:`, error);

      // Mark processing as failed if AI crashes
      await prisma.photo.update({
        where: { id: photo.id },
        data: { processingStatus: 'FAILED' },
      });

      return NextResponse.json({ error: 'AI processing failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('Photo Upload General Error:', error);
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
  }
}

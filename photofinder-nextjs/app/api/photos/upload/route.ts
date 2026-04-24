import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';
import { extractFaces } from '@/lib/ai';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { optimizeForStorage } from '@/lib/image';
import { getAppBaseUrl } from '@/lib/url';

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

      if (!faces || faces.length === 0) {
        // If no face detected, clean up the photo from Cloudinary and DB to save storage
        if (storageUrl) await deleteFromCloudinary(storageUrl);
        await prisma.photo.delete({ where: { id: photo.id } });
        return NextResponse.json({ error: 'Skipped: No faces found (discarded to save storage)' }, { status: 400 });
      }

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
      const completedPhoto = await prisma.photo.update({
        where: { id: photo.id },
        data: { processingStatus: 'COMPLETED' },
        include: { event: true },
      });

      // 7. Match faces against all registered UserFace embeddings
      //    and send LINE notifications to matched users
      try {
        const SIMILARITY_THRESHOLD = 0.55; // Cosine distance threshold (lower = more similar)

        // For each detected face, find matching UserFace in DB using pgvector
        for (const face of faces) {
          const vectorString = `[${face.embedding.join(',')}]`;

          // Query: find all UserFaces within similarity threshold
          const matches = await prisma.$queryRawUnsafe<Array<{
            userId: string;
            distance: number;
          }>>(`
            SELECT uf."userId", (uf."embedding" <=> $1::vector) AS distance
            FROM "user_faces" uf
            WHERE uf."embedding" IS NOT NULL
              AND (uf."embedding" <=> $1::vector) < $2
            ORDER BY distance ASC
          `, vectorString, SIMILARITY_THRESHOLD);

          // For each matched user, send LINE notification if they have linked LINE
          for (const match of matches) {
            const matchedUser = await prisma.user.findUnique({
              where: { id: match.userId },
              select: { lineUserId: true },
            });

            if (matchedUser?.lineUserId) {
              const confidence = 1 - match.distance; // Convert distance to confidence score
              const appUrl = getAppBaseUrl();
              const actionUrl = `${appUrl}/dashboard`;

              const { pushPhotoMatchNotification } = await import('@/lib/line');
              await pushPhotoMatchNotification(
                matchedUser.lineUserId,
                completedPhoto.event.name,
                confidence,
                completedPhoto.storageUrl,
                actionUrl
              );

              console.log(`[LINE] Sent notification to user ${match.userId} (confidence: ${(confidence * 100).toFixed(1)}%)`);
            }
          }
        }
      } catch (notifyError) {
        // Notification failure should NOT fail the upload response
        console.error('[LINE] Notification error (non-critical):', notifyError);
      }

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

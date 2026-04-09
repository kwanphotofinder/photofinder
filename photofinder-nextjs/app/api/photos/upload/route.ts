import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { extractFaces } from '@/lib/ai';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import sharp from 'sharp';

// Allow Vercel Hobby tier to wait up to 60 seconds for Hugging Face AI to wake up
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    // You can enforce authentication here
    // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;
    const uploaderId = user?.sub || (formData.get('uploaderId') as string | undefined);

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 1. Upload to Cloudinary into event-specific folder
    const storageUrl = await uploadToCloudinary(file.name, file.type, fileBuffer, eventId);

    // 2. Extract image dimensions using Sharp
    let width: number | null = null;
    let height: number | null = null;
    try {
      const metadata = await sharp(fileBuffer).metadata();
      width = metadata.width || null;
      height = metadata.height || null;
    } catch (error) {
      console.warn('Failed to extract image dimensions:', error);
    }

    // 3. Create Photo Record in Prisma
    const photo = await prisma.photo.create({
      data: {
        eventId,
        uploaderId,
        storageUrl,
        mimeType: file.type,
        processingStatus: 'PROCESSING',
        width,
        height,
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

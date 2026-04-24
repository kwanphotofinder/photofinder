import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';
import { extractFaces } from '@/lib/ai';
import { optimizeForStorage } from '@/lib/image';

export const maxDuration = 180; // Allow AI to wake up 

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.pdpaConsent) return NextResponse.json({ error: 'PDPA Consent required' }, { status: 403 });

    const userFace = await prisma.userFace.findUnique({
      where: { userId: user.sub },
      select: {
        id: true,
        imageUrl: true,
        createdAt: true,
      }
    });

    return NextResponse.json({ hasReference: !!userFace, userFace });
  } catch (error) {
    console.error('GET /api/me/reference-face error:', error);
    return NextResponse.json({ error: 'Failed to fetch reference face' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let storageUrl: string | null = null;
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.pdpaConsent) return NextResponse.json({ error: 'PDPA Consent required' }, { status: 403 });

    if (!process.env.CLOUDINARY_URL) {
      return NextResponse.json({ error: 'CLOUDINARY_URL is not configured' }, { status: 500 });
    }

    if (process.env.CLOUDINARY_URL.includes('api_key:api_secret@cloud_name')) {
      return NextResponse.json({ error: 'CLOUDINARY_URL is still using placeholder values' }, { status: 500 });
    }

    if (!process.env.AI_SERVICE_URL) {
      return NextResponse.json({ error: 'AI_SERVICE_URL is not configured' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    // Limit selfies to 5MB to protect Cloudinary free tier (previously 15MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 413 });
    }

    // 1. Read old reference face (we only delete old assets after new one is saved)
    const existingFace = await prisma.userFace.findUnique({ where: { userId: user.sub } });

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 2. Optimize and upload the new selfie to storage (resize + WebP)
    const optimized = await optimizeForStorage(fileBuffer);
    storageUrl = await uploadToCloudinary(file.name, 'image/webp', optimized.buffer);

    // 3. Extract face math using AI (send ORIGINAL buffer for best accuracy)
    const faces = await extractFaces(fileBuffer, file.name);
    
    if (!faces || faces.length === 0) {
      // If AI detects no face, delete the image we just uploaded
      await deleteFromCloudinary(storageUrl);
      return NextResponse.json({ error: 'No face detected in the image. Please use a closer selfie.' }, { status: 400 });
    }

    if (faces.length > 1) {
      // If there are multiple faces, it's not a good reference photo
      await deleteFromCloudinary(storageUrl);
      return NextResponse.json({ error: 'Multiple faces detected. Please upload a solo selfie.' }, { status: 400 });
    }

    // 4. Save to Database
    const vectorString = `[${faces[0].embedding.join(',')}]`;
    
    // We must use a raw query because of pgvector's custom types 
    const nextId = existingFace?.id || crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "user_faces" ("id", "userId", "imageUrl", "embedding", "updatedAt")
      VALUES ($1, $2, $3, $4::vector, NOW())
      ON CONFLICT ("userId")
      DO UPDATE SET
        "imageUrl" = EXCLUDED."imageUrl",
        "embedding" = EXCLUDED."embedding",
        "updatedAt" = NOW()
      `,
      nextId,
      user.sub,
      storageUrl,
      vectorString
    );

    // 5. Remove previous image only after new save succeeds
    if (existingFace?.imageUrl && existingFace.imageUrl !== storageUrl) {
      await deleteFromCloudinary(existingFace.imageUrl);
    }

    return NextResponse.json({ message: 'Reference face saved successfully!', imageUrl: storageUrl });

  } catch (error) {
    console.error('POST /api/me/reference-face error:', error);
    if (storageUrl) {
      await deleteFromCloudinary(storageUrl);
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to save reference face';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.pdpaConsent) return NextResponse.json({ error: 'PDPA Consent required' }, { status: 403 });

    const existingFace = await prisma.userFace.findUnique({ where: { userId: user.sub } });
    if (existingFace) {
      if (existingFace.imageUrl) await deleteFromCloudinary(existingFace.imageUrl);
      await prisma.userFace.delete({ where: { userId: user.sub } });
    }

    return NextResponse.json({ message: 'Reference face deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/me/reference-face error:', error);
    return NextResponse.json({ error: 'Failed to delete reference face' }, { status: 500 });
  }
}

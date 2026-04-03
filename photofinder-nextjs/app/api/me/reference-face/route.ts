import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary';
import { extractFaces } from '@/lib/ai';

export const maxDuration = 60; // Allow AI to wake up 

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // 1. Delete old reference face if they already have one
    const existingFace = await prisma.userFace.findUnique({ where: { userId: user.sub } });
    if (existingFace && existingFace.imageUrl) {
      await deleteFromCloudinary(existingFace.imageUrl);
      await prisma.userFace.delete({ where: { userId: user.sub } });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 2. Upload the new selfie to storage
    const storageUrl = await uploadToCloudinary(file.name, file.type, fileBuffer);

    // 3. Extract face math using AI
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
    await prisma.$executeRawUnsafe(`
      INSERT INTO "user_faces" ("id", "userId", "imageUrl", "embedding", "updatedAt") 
      VALUES (gen_random_uuid(), $1, $2, $3::vector, NOW())
    `, user.sub, storageUrl, vectorString);

    return NextResponse.json({ message: 'Reference face saved successfully!', imageUrl: storageUrl });

  } catch (error) {
    console.error('POST /api/me/reference-face error:', error);
    return NextResponse.json({ error: 'Failed to save reference face' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

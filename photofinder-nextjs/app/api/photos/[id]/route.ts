import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const user = await getUserFromRequest(req);
    
    // Optional: Protect route
    // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const photo = await prisma.photo.findUnique({
      where: { id: p.id },
      include: { faces: true },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // 1. Delete faces from Weaviate -> Wait! We are using pgvector now. 
    // They are natively deleted when we delete them from Postgres!

    // 2. Remove dependent records first so photo deletion cannot fail on FK constraints.
    await prisma.$transaction([
      prisma.removalRequest.deleteMany({
        where: { photoId: p.id },
      }),
      prisma.savedPhoto.deleteMany({
        where: { photoId: p.id },
      }),
      prisma.abuseReport.deleteMany({
        where: { photoId: p.id },
      }),
      prisma.face.deleteMany({
        where: { photoId: p.id },
      }),
      prisma.photo.delete({
        where: { id: p.id },
      }),
    ]);

    // 3. Delete original file from Cloudinary 
    await deleteFromCloudinary(photo.storageUrl);

    return NextResponse.json({ message: 'Photo deleted successfully', id: p.id });
  } catch (error) {
    console.error('DELETE /api/photos/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}

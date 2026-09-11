import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { deleteFromCloudinary } from '@/lib/cloudinary';

// DELETE /api/admin/admins/[userId] - permanently remove a user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const caller = await getUserFromRequest(req);

    // Only SUPER_ADMIN can permanently remove users
    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can permanently remove users' }, { status: 403 });
    }

    const p = await params;

    const target = await prisma.user.findUnique({ where: { id: p.userId } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cannot remove a SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot remove Super Admin' }, { status: 403 });
    }

    // Cannot remove yourself
    if (target.id === caller.sub) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    // Step 1: Find all photos uploaded by this user to delete them from Cloudinary
    const uploadedPhotos = await prisma.photo.findMany({
      where: { uploaderId: p.userId },
      select: { storageUrl: true },
    });

    // Step 2: Find the user's reference selfie to delete it from Cloudinary
    const userFace = await prisma.userFace.findUnique({
      where: { userId: p.userId },
      select: { imageUrl: true },
    });

    // Step 3: Delete actual files from Cloudinary
    for (const photo of uploadedPhotos) {
      if (photo.storageUrl) await deleteFromCloudinary(photo.storageUrl).catch(console.error);
    }
    if (userFace?.imageUrl) {
      await deleteFromCloudinary(userFace.imageUrl).catch(console.error);
    }

    // Step 4: Delete related records for compatibility with non-cascade legacy DBs.
    await prisma.$transaction(async (tx) => {
      const uploadedPhotos = await tx.photo.findMany({
        where: { uploaderId: p.userId },
        select: { id: true },
      });

      const photoIds = uploadedPhotos.map((photo) => photo.id);

      if (photoIds.length > 0) {
        await tx.removalRequest.deleteMany({ where: { photoId: { in: photoIds } } });
        await tx.savedPhoto.deleteMany({ where: { photoId: { in: photoIds } } });
        await tx.abuseReport.deleteMany({ where: { photoId: { in: photoIds } } });
        await tx.face.deleteMany({ where: { photoId: { in: photoIds } } });
      }

      await tx.photo.deleteMany({ where: { uploaderId: p.userId } });
      await tx.removalRequest.deleteMany({ where: { userId: p.userId } });
      await tx.savedPhoto.deleteMany({ where: { userId: p.userId } });
      await tx.abuseReport.deleteMany({ where: { reporterId: p.userId } });
      await tx.delivery.deleteMany({ where: { userId: p.userId } });
      await tx.userFace.deleteMany({ where: { userId: p.userId } });
      await tx.user.delete({ where: { id: p.userId } });
    });

    return NextResponse.json({
      message: `User ${target.email} has been permanently removed from the system`,
    });
  } catch (error) {
    console.error('DELETE /api/admin/admins/[userId] error:', error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}

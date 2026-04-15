import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// DELETE /api/admin/admins/[userId] - permanently remove an admin user
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const caller = await getUserFromRequest(req);

    // Only SUPER_ADMIN can remove admins
    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can remove admins' }, { status: 403 });
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

    // Only ADMIN role can be permanently removed via this endpoint
    if (target.role !== 'ADMIN') {
      return NextResponse.json({ error: 'This endpoint only removes Admin users. Use the demotion endpoint for other roles.' }, { status: 400 });
    }

    // Cannot remove yourself
    if (target.id === caller.sub) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
    }

    // Delete related records for compatibility with non-cascade legacy DBs.
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
      message: `Admin ${target.email} has been permanently removed from the system`,
    });
  } catch (error) {
    console.error('DELETE /api/admin/admins/[userId] error:', error);
    return NextResponse.json({ error: 'Failed to remove admin' }, { status: 500 });
  }
}

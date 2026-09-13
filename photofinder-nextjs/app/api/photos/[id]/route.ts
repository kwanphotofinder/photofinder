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
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const photo = await prisma.photo.findUnique({
      where: { id: p.id },
      include: { faces: true },
    });

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Check if the user is authorized to delete this photo
    // ADMIN and SUPER_ADMIN can delete anything, otherwise only the uploader
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && photo.uploaderId !== user.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Delete the photo from Postgres.
    // Thanks to Prisma Cascade deletes, all connected faces, reports, and saved records will be wiped automatically.
    await prisma.photo.delete({
      where: { id: p.id },
    });

    // 3. Delete original file from Cloudinary 
    await deleteFromCloudinary(photo.storageUrl);

    const { recordAuditLog } = await import("@/lib/audit-logger");
    await recordAuditLog({
      actorId: user.sub,
      actorEmail: user.email || "unknown_user",
      actorRole: user.role,
      action: "DELETE_PHOTO",
      category: "CONTENT",
      targetType: "PHOTO",
      targetId: p.id,
      targetLabel: `Photo #${p.id.slice(0, 8)}`,
      details: `Deleted photo and associated face records.`,
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
    });

    return NextResponse.json({ message: 'Photo deleted successfully', id: p.id });
  } catch (error) {
    console.error('DELETE /api/photos/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const user = await getUserFromRequest(req);
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingReq = await prisma.removalRequest.findUnique({
      where: { id: p.id },
      include: {
        photo: { select: { id: true, event: { select: { name: true } } } },
      },
    });

    await prisma.removalRequest.delete({
      where: { id: p.id },
    });

    // Log audit event
    const { recordAuditLog } = await import("@/lib/audit-logger");
    await recordAuditLog({
      actorId: user.sub,
      actorEmail: user.email,
      actorRole: user.role,
      action: "REMOVAL_REQUEST_RESOLVED",
      category: "CONTENT",
      targetType: "PHOTO",
      targetId: existingReq?.photoId || null,
      targetLabel: existingReq?.photo?.event?.name ? `Photo in ${existingReq.photo.event.name}` : `Photo ${existingReq?.photoId}`,
      details: `Admin resolved/dismissed removal request #${p.id} (${existingReq?.requestType || 'TAKEDOWN'})`,
    });

    return NextResponse.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/removal-requests/[id] error:', error);
    return NextResponse.json({ error: 'Request not found or failed to delete' }, { status: 404 });
  }
}

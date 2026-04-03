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
    // if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await prisma.removalRequest.delete({
      where: { id: p.id },
    });

    return NextResponse.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/removal-requests/[id] error:', error);
    return NextResponse.json({ error: 'Request not found or failed to delete' }, { status: 404 });
  }
}

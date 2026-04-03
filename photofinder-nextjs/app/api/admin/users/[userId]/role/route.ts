import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

// DELETE /api/admin/users/[userId]/role - demote user back to STUDENT
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const caller = await getUserFromRequest(req);
    if (!caller || !['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const p = await params;

    const target = await prisma.user.findUnique({ where: { id: p.userId } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Only SUPER_ADMIN can demote admins
    if (target.role === 'ADMIN' && caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can demote admins' }, { status: 403 });
    }

    // Cannot demote a SUPER_ADMIN ever
    if (target.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot demote Super Admin' }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: p.userId },
      data: { role: 'STUDENT' },
    });

    return NextResponse.json({ message: `${target.email} has been demoted to Student`, user: updatedUser });
  } catch (error) {
    console.error('DELETE /api/admin/users/[userId]/role error:', error);
    return NextResponse.json({ error: 'Failed to demote user' }, { status: 500 });
  }
}

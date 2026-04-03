import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { Role } from '@prisma/client';

// POST /api/admin/users/set-role - set a user's role by email (creates user if not exists)
export async function POST(req: NextRequest) {
  try {
    const caller = await getUserFromRequest(req);
    if (!caller || !['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 });
    }

    // Only SUPER_ADMIN can assign ADMIN role
    if (role === 'ADMIN' && caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can assign Admin role' }, { status: 403 });
    }

    const validRoles = ['STUDENT', 'ADMIN', 'PHOTOGRAPHER', 'SUPER_ADMIN'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Upsert user: create if not exists, update role if exists
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: role as Role },
      create: {
        email,
        role: role as Role,
        name: email.split('@')[0],
      },
    });

    return NextResponse.json({ message: `User ${email} role set to ${role}`, user });
  } catch (error) {
    console.error('POST /api/admin/users/set-role error:', error);
    return NextResponse.json({ error: 'Failed to set user role' }, { status: 500 });
  }
}

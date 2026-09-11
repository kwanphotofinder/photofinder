import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const dbUser = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { emailNotifications: true }
    });

    return NextResponse.json({ enabled: dbUser?.emailNotifications || false });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { enabled } = await req.json();

    const updatedUser = await prisma.user.update({
      where: { id: user.sub },
      data: { emailNotifications: !!enabled },
      select: { emailNotifications: true }
    });

    return NextResponse.json({ enabled: updatedUser.emailNotifications });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

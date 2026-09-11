import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { userId, eventId } = body;

    if (!userId || !eventId) {
      return NextResponse.json({ error: 'User ID and Event ID are required' }, { status: 400 });
    }

    // 1. Create a delivery record
    const delivery = await prisma.delivery.create({
      data: {
        userId,
        eventId,
        status: 'PENDING',
      },
    });

    console.log(`Sending photos for Event ${eventId} to User ${userId}...`);

    // In a serverless environment like Vercel, you cannot use setTimeout()
    // inside an API route to run a background task. 
    // Thus, we simulate the delivery by updating it immediately.
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: 'SENT', sentAt: new Date() },
    });

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    console.error('Delivery POST error:', error);
    return NextResponse.json({ error: 'Failed to trigger delivery' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { RemovalRequestType } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { photoId, requestType, userName, userEmail, reason } = body;

    if (!userName) {
      return NextResponse.json({ error: 'User name required' }, { status: 400 });
    }

    // Find or create user
    const emailToUse = userEmail || `${userName.toLowerCase().replace(/\\s+/g, '')}@temp.local`;
    let user = await prisma.user.findUnique({
      where: { email: emailToUse },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: emailToUse,
          name: userName,
          role: 'STUDENT',
        },
      });
    }

    const request = await prisma.removalRequest.create({
      data: {
        photoId,
        userId: user.id,
        // Enforcing strictly typed Enum from Prisma
        requestType: requestType?.toUpperCase() as RemovalRequestType || RemovalRequestType.DELETE,
        reason,
      },
    });

    return NextResponse.json({
      message: 'Removal request submitted successfully',
      requestId: request.id,
    }, { status: 201 });

  } catch (error) {
    console.error('Removal Request POST error:', error);
    return NextResponse.json({ error: 'Failed to create removal request' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const requests = await prisma.removalRequest.findMany({
      include: {
        photo: {
          include: { event: true },
        },
        user: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedRequests = requests.map(req => ({
      id: req.id,
      photoId: req.photoId,
      requestType: req.requestType,
      userName: req.user?.name || 'Unknown',
      reason: req.reason,
      createdAt: req.createdAt,
      status: req.status,
      photo: req.photo ? {
        id: req.photo.id,
        url: req.photo.storageUrl,
        eventName: req.photo.event.name,
      } : null,
    }));

    return NextResponse.json(mappedRequests);
  } catch (error) {
    console.error('Removal Request GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch removal requests' }, { status: 500 });
  }
}

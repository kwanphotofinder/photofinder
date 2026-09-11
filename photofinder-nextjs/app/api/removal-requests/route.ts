import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { RemovalRequestType } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { photoId, requestType, reason, faceCoordinates } = body;

    if (!photoId) {
      return NextResponse.json({ error: 'Photo ID required' }, { status: 400 });
    }

    const request = await prisma.removalRequest.create({
      data: {
        photoId,
        userId: user.sub,
        // Enforcing strictly typed Enum from Prisma
        requestType: requestType?.toUpperCase() as RemovalRequestType || RemovalRequestType.DELETE,
        reason,
        faceCoordinates,
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
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

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
      faceCoordinates: req.faceCoordinates,
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

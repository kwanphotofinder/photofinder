import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const photos = await prisma.photo.findMany({
      include: { event: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(photos);
  } catch (error) {
    console.error('GET /api/photos error:', error);
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 });
  }
}

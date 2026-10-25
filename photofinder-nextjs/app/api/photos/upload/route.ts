import { NextRequest, NextResponse } from 'next/server';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { optimizeForStorage } from '@/lib/image';
import { recordLogTap, createTraceId, extractClientInfo } from '@/lib/log-tap';
import { trackError } from '@/lib/error-tracker';
import { aiQueue } from '@/lib/ai-queue';

export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const traceId = createTraceId();
  const { ip, userAgent } = extractClientInfo(req);
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'PHOTOGRAPHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;
    const uploaderId = user.sub;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 413 });
    }
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 1. Optimize image for storage (resize to 2048px + WebP quality 85)
    const optimized = await optimizeForStorage(fileBuffer);

    // 2. Duplicate Detection: Check if a photo with matching dimensions & base name exists in this event
    const baseName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_');
    const existingPhoto = await prisma.photo.findFirst({
      where: {
        eventId,
        width: optimized.width,
        height: optimized.height,
        storageUrl: { contains: `/${baseName}_` }
      }
    });

    if (existingPhoto) {
      return NextResponse.json({
        photoId: existingPhoto.id,
        storageUrl: existingPhoto.storageUrl,
        status: 'skipped',
        message: `Photo ${file.name} already exists in this event`
      }, { status: 200 });
    }

    // 3. Upload the OPTIMIZED version to Cloudinary (saves ~70-80% storage)
    const storageUrl = await uploadToCloudinary(file.name, 'image/webp', optimized.buffer, eventId);

    // 4. Create Photo Record in Prisma with PENDING status
    const photo = await prisma.photo.create({
      data: {
        eventId,
        uploaderId,
        storageUrl,
        mimeType: 'image/webp',
        processingStatus: 'PENDING',
        width: optimized.width,
        height: optimized.height,
      },
    });

    // 5. Enqueue into background AI Processing Queue (non-blocking, handled smoothly by worker pool)
    await aiQueue.enqueue({
      photoId: photo.id,
      storageUrl,
      imageBuffer: optimized.buffer,
      fileName: file.name,
    });

    recordLogTap({
      traceId,
      method: 'POST',
      path: '/api/photos/upload',
      statusCode: 201,
      durationMs: Date.now() - startTime,
      ipAddress: ip,
      userAgent,
      userId: user?.sub,
      userEmail: user?.email,
      outputSummary: { photoId: photo.id, status: 'queued' },
    });

    return NextResponse.json({
      photoId: photo.id,
      storageUrl,
      status: 'queued',
      message: 'Photo uploaded and enqueued for AI face processing',
    }, { status: 201 });

  } catch (error) {
    console.error('Photo Upload General Error:', error);
    trackError({
      error,
      route: '/api/photos/upload',
      method: 'POST',
      statusCode: 500,
      severity: 'ERROR',
      traceId,
      ipAddress: ip,
    });
    recordLogTap({
      traceId,
      method: 'POST',
      path: '/api/photos/upload',
      statusCode: 500,
      durationMs: Date.now() - startTime,
      ipAddress: ip,
      userAgent,
      isError: true,
      errorMessage: error instanceof Error ? error.message : 'Upload process failed',
    });
    return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
  }
}

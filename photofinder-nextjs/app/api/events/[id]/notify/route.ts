import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { getAppBaseUrl } from '@/lib/url';
import { pushBatchPhotoMatchNotification } from '@/lib/line';
import { sendPhotoMatchSummaryEmail } from '@/lib/gmail';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    if (user.role !== 'PHOTOGRAPHER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: eventId } = await params;
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        photos: {
          include: {
            faces: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // SIMILARITY_THRESHOLD should match the one used in the upload route
    const SIMILARITY_THRESHOLD = 0.55;

    // 1. Get all face embeddings from this event's photos
    const allFaces = event.photos.flatMap(p => p.faces);
    
    if (allFaces.length === 0) {
      return NextResponse.json({ 
        message: 'No faces found in this event',
        notified: 0 
      });
    }

    // 2. Find all matching users for all faces in one go (per face)
    // To optimize, we group by student to avoid duplicate notifications
    const userMatchCounts: Record<string, number> = {};

    for (const face of allFaces) {
      // We skip faces that don't have embeddings (though they should)
      // Note: face.embedding is technically "Unsupported" type in Prisma
      
      // Use $queryRaw with template literals (safer and standard for Prisma)
      const res = await prisma.$queryRaw<Array<{ embedding: string }>>`
        SELECT embedding::text FROM faces WHERE id = ${face.id}
      `;
      const vectorString = res[0]?.embedding;

      if (!vectorString) continue;

      const matches = await prisma.$queryRaw<Array<{ userId: string }>>`
        SELECT "userId"
        FROM "user_faces"
        WHERE "embedding" IS NOT NULL
          AND ("embedding" <=> ${vectorString}::vector) < ${SIMILARITY_THRESHOLD}
      `;

      for (const match of matches) {
        userMatchCounts[match.userId] = (userMatchCounts[match.userId] || 0) + 1;
      }
    }

    const matchedUserIds = Object.keys(userMatchCounts);
    if (matchedUserIds.length === 0) {
      return NextResponse.json({ 
        message: 'No student matches found for this event',
        notified: 0 
      });
    }

    // 3. Fetch user details (LINE and Email settings)
    const usersToNotify = await prisma.user.findMany({
      where: {
        id: { in: matchedUserIds },
        isActive: true,
        pdpaConsent: true, // Only notify if they gave consent
      },
      select: {
        id: true,
        email: true,
        name: true,
        lineUserId: true,
        emailNotifications: true,
      }
    });

    let linesSent = 0;
    let emailsSent = 0;
    const appUrl = getAppBaseUrl();
    const actionUrl = `${appUrl}/dashboard`;

    // 4. Send notifications
    for (const u of usersToNotify) {
      const matchCount = userMatchCounts[u.id];
      const name = u.name || 'Student';

      // Send LINE
      if (u.lineUserId) {
        await pushBatchPhotoMatchNotification(
          u.lineUserId,
          event.name,
          matchCount,
          actionUrl
        );
        linesSent++;
      }

      // Send Email
      if (u.emailNotifications) {
        await sendPhotoMatchSummaryEmail(
          u.email,
          name,
          event.name,
          matchCount,
          actionUrl
        );
        emailsSent++;
      }
    }

    return NextResponse.json({
      message: 'Notifications sent successfully',
      notified: usersToNotify.length,
      linesSent,
      emailsSent
    });

  } catch (error) {
    console.error('Batch notify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

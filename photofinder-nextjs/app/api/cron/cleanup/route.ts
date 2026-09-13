import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { deleteFolderFromCloudinary } from '@/lib/cloudinary';
import { getUserFromRequest } from '@/lib/auth';

// This allows the cron job to run for up to 60 seconds
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Basic security: only allow requests with the correct authorization header
    // In production, Vercel Cron automatically sends this header
    const authHeader = request.headers.get('authorization');
    let isAuthorized = false;

    // Check 1: Is it the valid Cron Secret from Vercel/Local?
    if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      isAuthorized = true;
    } 
    // Check 2: If not cron secret, is it an actual logged-in Admin hitting the manual button?
    else {
      const payload = await getUserFromRequest(request);
      if (payload && (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN')) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    console.log('Running daily cleanup job...');

    // 1. Find all expired events
    const expiredEvents = await prisma.event.findMany({
      where: {
        expiresAt: {
          lte: new Date() // expired in the past
        }
      },
      select: { id: true, name: true }
    });

    const deletedIds: string[] = [];

    if (expiredEvents.length > 0) {
      // 2. Process each expired event safely
      for (const event of expiredEvents) {
        try {
          console.log(`Deleting expired event: ${event.name} (${event.id})`);
          
          // Step A: Delete physical folder from Cloudinary
          // We do this first because if the DB deletes first, we lose the event ID and leave orphaned files
          await deleteFolderFromCloudinary(event.id);
          
          // Step B: Delete from Database
          // Thanks to our Prisma 'Cascade' setup, this single command instantly wipes:
          // the event, thousands of photos, their pgvector faces, saved photos, and abuse reports!
          await prisma.event.delete({
            where: { id: event.id }
          });

          deletedIds.push(event.id);
        } catch (err) {
          console.error(`Failed to delete event ${event.id}:`, err);
          // Continue to the next event even if one fails
        }
      }
    }

    // 3. Purge Audit Logs older than 90 days (PDPA Compliance)
    let purgedAuditLogsCount = 0;
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const purgeResult = await (prisma as any).auditLog.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
        },
      });
      purgedAuditLogsCount = purgeResult.count;
      console.log(`Purged ${purgedAuditLogsCount} audit logs older than 90 days.`);
    } catch (auditErr) {
      console.error('Failed to purge expired audit logs:', auditErr);
    }

    return NextResponse.json({ 
      message: 'Cleanup successful', 
      deletedCount: deletedIds.length,
      deletedIds,
      purgedAuditLogsCount
    });

  } catch (error) {
    console.error('Cron cleanup error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

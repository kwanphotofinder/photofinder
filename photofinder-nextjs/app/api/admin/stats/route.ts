import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    // 1. Verify caller is an admin
    const caller = await getUserFromRequest(req);
    if (!caller || !['ADMIN', 'SUPER_ADMIN'].includes(caller.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Fetch all stats concurrently for speed
    const [
      totalUsers,
      totalEvents,
      totalPhotos,
      facesDetected,
      activeEvents,
      eventsByStatusRaw,
      photosByStatusRaw,
      usersByRoleRaw
    ] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.photo.count(),
      prisma.face.count(),
      prisma.event.count({ where: { status: 'PUBLISHED' } }),
      prisma.event.groupBy({ by: ['status'], _count: true }),
      prisma.photo.groupBy({ by: ['processingStatus'], _count: true }),
      prisma.user.groupBy({ by: ['role'], _count: true })
    ]);

    // 3. Format grouped data into the exact structure the frontend expects
    const eventsByStatus = eventsByStatusRaw.map(e => ({
      status: e.status,
      count: e._count
    }));

    // Frontend expects 'status' instead of 'processingStatus' for the pie chart
    const photosByStatus = photosByStatusRaw.map(p => ({
      status: p.processingStatus,
      count: p._count
    }));

    const usersByRole = usersByRoleRaw.map(u => ({
      role: u.role,
      count: u._count
    }));

    // 4. Return the formatted data
    return NextResponse.json({
      totalUsers,
      totalEvents,
      totalPhotos,
      facesDetected,
      activeEvents,
      eventsByStatus,
      photosByStatus,
      usersByRole
    });
  } catch (error) {
    console.error("GET /api/admin/stats error:", error);
    return NextResponse.json({ error: "Failed to fetch admin stats" }, { status: 500 });
  }
}

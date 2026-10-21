import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || (caller.role !== "ADMIN" && caller.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 })
    }

    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const [
      totalTaps24h,
      success2xx,
      clientError4xx,
      serverError5xx,
      unresolvedErrorsCount,
      criticalErrorsCount,
      recentTaps,
    ] = await Promise.all([
      (prisma as any).logTap.count({
        where: { createdAt: { gte: past24h } },
      }),
      (prisma as any).logTap.count({
        where: { createdAt: { gte: past24h }, statusCode: { gte: 200, lt: 300 } },
      }),
      (prisma as any).logTap.count({
        where: { createdAt: { gte: past24h }, statusCode: { gte: 400, lt: 500 } },
      }),
      (prisma as any).logTap.count({
        where: { createdAt: { gte: past24h }, statusCode: { gte: 500, lt: 600 } },
      }),
      (prisma as any).errorTrackLog.count({
        where: { status: "UNRESOLVED" },
      }),
      (prisma as any).errorTrackLog.count({
        where: { status: "UNRESOLVED", severity: "CRITICAL" },
      }),
      (prisma as any).logTap.findMany({
        where: { createdAt: { gte: past24h } },
        select: { path: true, durationMs: true, isError: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
    ])

    // Compute average duration and error rates
    const avgDurationMs = recentTaps.length > 0
      ? Math.round(recentTaps.reduce((acc: number, t: any) => acc + (t.durationMs || 0), 0) / recentTaps.length)
      : 0

    const errorCount = clientError4xx + serverError5xx
    const errorRatePercent = totalTaps24h > 0
      ? parseFloat(((errorCount / totalTaps24h) * 100).toFixed(1))
      : 0

    // Top failing endpoints
    const routeFailures: Record<string, number> = {}
    for (const tap of recentTaps) {
      if (tap.isError) {
        routeFailures[tap.path] = (routeFailures[tap.path] || 0) + 1
      }
    }
    const topFailingRoutes = Object.entries(routeFailures)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return NextResponse.json({
      period: "24h",
      totalTaps24h,
      statusCodeBreakdown: {
        success2xx,
        clientError4xx,
        serverError5xx,
      },
      errorRatePercent,
      avgDurationMs,
      unresolvedErrorsCount,
      criticalErrorsCount,
      topFailingRoutes,
    })
  } catch (error) {
    console.error("[API LogStats] Failed to fetch stats:", error)
    return NextResponse.json({ error: "Failed to fetch log statistics" }, { status: 500 })
  }
}

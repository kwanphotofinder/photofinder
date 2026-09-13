import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)

    // Strictly enforce SUPER_ADMIN role only
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return new NextResponse(
        JSON.stringify({ error: "Access denied. Super Admin privileges required." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")?.toUpperCase() || ""
    const search = searchParams.get("search")?.trim() || ""
    const format = searchParams.get("format")?.toLowerCase() || "json"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)))
    const skip = (page - 1) * limit

    // Build Prisma where filter
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const where: any = {
      createdAt: {
        gte: ninetyDaysAgo,
      },
    }

    if (category && category !== "ALL") {
      where.category = category
    }

    if (search) {
      where.OR = [
        { actorEmail: { contains: search, mode: "insensitive" } },
        { targetLabel: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
        { details: { contains: search, mode: "insensitive" } },
      ]
    }

    // CSV Export Mode
    if (format === "csv") {
      const allLogs = await (prisma as any).auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 2000, // Export limit for safety
      })

      const csvRows = [
        ["Timestamp", "Actor Email", "Actor Role", "Category", "Action", "Target Type", "Target Label", "Details", "IP Address"].join(","),
        ...allLogs.map((log: any) =>
          [
            `"${new Date(log.createdAt).toISOString()}"`,
            `"${(log.actorEmail || "").replace(/"/g, '""')}"`,
            `"${log.actorRole || ""}"`,
            `"${log.category || ""}"`,
            `"${log.action || ""}"`,
            `"${log.targetType || ""}"`,
            `"${(log.targetLabel || "").replace(/"/g, '""')}"`,
            `"${(log.details || "").replace(/"/g, '""')}"`,
            `"${log.ipAddress || ""}"`,
          ].join(",")
        ),
      ]

      const csvContent = csvRows.join("\n")
      const filename = `photofinder_audit_logs_${new Date().toISOString().split("T")[0]}.csv`

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    // Standard Paginated JSON Response
    const [logs, total] = await Promise.all([
      (prisma as any).auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      (prisma as any).auditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("[AuditLogsAPI] Error retrieving audit logs:", error)
    return new NextResponse(
      JSON.stringify({ error: "Failed to retrieve audit logs" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

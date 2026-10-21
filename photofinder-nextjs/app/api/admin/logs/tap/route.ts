import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || (caller.role !== "ADMIN" && caller.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim() || ""
    const method = searchParams.get("method")?.toUpperCase() || ""
    const statusGroup = searchParams.get("status") || "ALL"
    const onlyErrors = searchParams.get("onlyErrors") === "true"
    const format = searchParams.get("format")?.toLowerCase() || "json"
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)))
    const skip = (page - 1) * limit

    const where: any = {}

    if (method && method !== "ALL") {
      where.method = method
    }

    if (onlyErrors) {
      where.isError = true
    } else if (statusGroup === "2xx") {
      where.statusCode = { gte: 200, lt: 300 }
    } else if (statusGroup === "4xx") {
      where.statusCode = { gte: 400, lt: 500 }
    } else if (statusGroup === "5xx") {
      where.statusCode = { gte: 500, lt: 600 }
    }

    if (search) {
      where.OR = [
        { path: { contains: search, mode: "insensitive" } },
        { traceId: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
        { errorMessage: { contains: search, mode: "insensitive" } },
        { inputPayload: { contains: search, mode: "insensitive" } },
      ]
    }

    if (format === "csv") {
      const allTaps = await (prisma as any).logTap.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 2000,
      })

      const csvRows = [
        ["Timestamp", "Trace ID", "Method", "Path", "Status Code", "Duration (ms)", "Client IP", "User Email", "Error Message"].join(","),
        ...allTaps.map((tap: any) =>
          [
            `"${new Date(tap.createdAt).toISOString()}"`,
            `"${tap.traceId || ""}"`,
            `"${tap.method || ""}"`,
            `"${(tap.path || "").replace(/"/g, '""')}"`,
            tap.statusCode,
            tap.durationMs,
            `"${tap.ipAddress || ""}"`,
            `"${tap.userEmail || ""}"`,
            `"${(tap.errorMessage || "").replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ]

      const csvContent = csvRows.join("\n")
      const filename = `photofinder_log_tap_${new Date().toISOString().split("T")[0]}.csv`

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    const [items, total] = await Promise.all([
      (prisma as any).logTap.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      (prisma as any).logTap.count({ where }),
    ])

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("[API LogTap] Failed to fetch tap logs:", error)
    return NextResponse.json({ error: "Failed to fetch log tap entries" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin privileges required to prune logs." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = Math.max(1, parseInt(searchParams.get("days") || "14", 10))
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const result = await (prisma as any).logTap.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      prunedBefore: cutoffDate.toISOString(),
    })
  } catch (error) {
    console.error("[API LogTap] Failed to prune tap logs:", error)
    return NextResponse.json({ error: "Failed to prune log tap entries" }, { status: 500 })
  }
}

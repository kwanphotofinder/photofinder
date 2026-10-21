import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/auth"
import { generateCurlReproduction } from "@/lib/error-tracker"

export async function GET(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || (caller.role !== "ADMIN" && caller.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "ALL"
    const severity = searchParams.get("severity") || "ALL"
    const search = searchParams.get("search")?.trim() || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(10, parseInt(searchParams.get("limit") || "20", 10)))
    const skip = (page - 1) * limit

    const where: any = {}

    if (status && status !== "ALL") {
      where.status = status
    }
    if (severity && severity !== "ALL") {
      where.severity = severity
    }
    if (search) {
      where.OR = [
        { errorName: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
        { route: { contains: search, mode: "insensitive" } },
        { userEmail: { contains: search, mode: "insensitive" } },
      ]
    }

    const [items, total] = await Promise.all([
      (prisma as any).errorTrackLog.findMany({
        where,
        orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
        skip,
        take: limit,
      }),
      (prisma as any).errorTrackLog.count({ where }),
    ])

    // Augment items with reproduction cURL string
    const host = request.headers.get("host") || "localhost:3000"
    const protocol = request.headers.get("x-forwarded-proto") || "http"
    const baseUrl = `${protocol}://${host}`

    const augmentedItems = items.map((item: any) => ({
      ...item,
      reproduceCurl: generateCurlReproduction(
        baseUrl,
        item.route,
        item.method,
        item.queryParams,
        item.requestBody
      ),
    }))

    return NextResponse.json({
      items: augmentedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error("[API ErrorTrack] Failed to fetch error logs:", error)
    return NextResponse.json({ error: "Failed to fetch error track logs" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || (caller.role !== "ADMIN" && caller.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 })
    }

    const body = await request.json()
    const { id, status } = body

    if (!id || !["UNRESOLVED", "INVESTIGATING", "RESOLVED", "IGNORED"].includes(status)) {
      return NextResponse.json({ error: "Invalid ID or status" }, { status: 400 })
    }

    const updated = await (prisma as any).errorTrackLog.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
        resolvedBy: status === "RESOLVED" ? caller.email : null,
      },
    })

    return NextResponse.json({ success: true, item: updated })
  } catch (error) {
    console.error("[API ErrorTrack] Failed to update error status:", error)
    return NextResponse.json({ error: "Failed to update error status" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin privileges required to delete error logs." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const clearResolved = searchParams.get("clearResolved") === "true"

    if (id) {
      await (prisma as any).errorTrackLog.delete({
        where: { id },
      })
      return NextResponse.json({ success: true, deletedId: id })
    }

    if (clearResolved) {
      const result = await (prisma as any).errorTrackLog.deleteMany({
        where: { status: { in: ["RESOLVED", "IGNORED"] } },
      })
      return NextResponse.json({ success: true, deletedCount: result.count })
    }

    return NextResponse.json({ error: "Specify id or clearResolved=true" }, { status: 400 })
  } catch (error) {
    console.error("[API ErrorTrack] Failed to delete error log:", error)
    return NextResponse.json({ error: "Failed to delete error log" }, { status: 500 })
  }
}

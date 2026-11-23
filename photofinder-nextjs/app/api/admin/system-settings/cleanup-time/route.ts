import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import { recordAuditLog } from "@/lib/audit-logger"
import { formatCleanupTime, getCleanupState, isValidCleanupTime, setCleanupTimeMinutes } from "@/lib/cleanup-settings"

export async function GET(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin privileges required." }, { status: 403 })
    }

    const { minutes, lastRunAt } = await getCleanupState()
    return NextResponse.json({ minutes, lastRunAt: lastRunAt?.toISOString() ?? null })
  } catch (error) {
    console.error("GET /api/admin/system-settings/cleanup-time error:", error)
    return NextResponse.json({ error: "Failed to load cleanup time" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Super Admin privileges required." }, { status: 403 })
    }

    const body = await request.json()
    const minutes = Number(body.minutes)
    if (!isValidCleanupTime(minutes)) {
      return NextResponse.json({ error: "Cleanup time must be between 00:00 and 23:59." }, { status: 400 })
    }

    const { minutes: previousMinutes, lastRunAt } = await getCleanupState()
    await setCleanupTimeMinutes(minutes)

    await recordAuditLog({
      actorId: caller.sub,
      actorEmail: caller.email,
      actorRole: caller.role,
      action: "CLEANUP_TIME_UPDATE",
      category: "CONTENT",
      targetType: "SYSTEM",
      targetLabel: "Daily cleanup time",
      details: `Changed daily cleanup time from ${formatCleanupTime(previousMinutes)} to ${formatCleanupTime(minutes)} (Asia/Bangkok).`,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
    })

    return NextResponse.json({ minutes, lastRunAt: lastRunAt?.toISOString() ?? null })
  } catch (error) {
    console.error("PATCH /api/admin/system-settings/cleanup-time error:", error)
    return NextResponse.json({ error: "Failed to update cleanup time" }, { status: 500 })
  }
}

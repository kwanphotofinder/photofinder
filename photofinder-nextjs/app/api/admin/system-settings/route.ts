import { NextRequest, NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/auth"
import {
  SYSTEM_SETTING_DEFINITIONS,
  getAllSystemSettings,
  updateSystemSettings,
  resetSystemSettingsToDefaults,
  getSystemSecretsMetadata,
  updateSystemSecrets,
} from "@/lib/system-settings"

export async function GET(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Super Admin privileges required to view system settings." },
        { status: 403 }
      )
    }

    const [settings, secrets] = await Promise.all([
      getAllSystemSettings(),
      getSystemSecretsMetadata(),
    ])
    const definitions = Object.values(SYSTEM_SETTING_DEFINITIONS)

    return NextResponse.json({
      settings,
      definitions,
      secrets,
      callerRole: caller.role,
      callerEmail: caller.email,
    })
  } catch (error) {
    console.error("GET /api/admin/system-settings error:", error)
    return NextResponse.json(
      { error: "Failed to load system settings" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Super Admin privileges required to update system settings." },
        { status: 403 }
      )
    }

    const body = await request.json()
    if (!body || (typeof body.settings !== "object" && typeof body.secrets !== "object")) {
      return NextResponse.json(
        { error: "Invalid payload: 'settings' or 'secrets' object is required." },
        { status: 400 }
      )
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
    let totalChanged = 0
    let currentSettings = await getAllSystemSettings()

    // 1. Update numerical and toggle settings if provided
    if (body.settings && typeof body.settings === "object") {
      const result = await updateSystemSettings(body.settings, {
        id: caller.sub,
        email: caller.email,
        role: caller.role,
        ip,
      })
      totalChanged += result.changedCount
      currentSettings = result.settings
    }

    // 2. Update external API keys / secrets if provided
    if (body.secrets && typeof body.secrets === "object") {
      const secretResult = await updateSystemSecrets(body.secrets, {
        id: caller.sub,
        email: caller.email,
        role: caller.role,
        ip,
      })
      totalChanged += secretResult.changedCount
    }

    const updatedSecrets = await getSystemSecretsMetadata()

    return NextResponse.json({
      success: true,
      settings: currentSettings,
      secrets: updatedSecrets,
      changedCount: totalChanged,
    })
  } catch (error) {
    console.error("PATCH /api/admin/system-settings error:", error)
    return NextResponse.json(
      { error: "Failed to update system settings" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller || caller.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Super Admin privileges required to reset system settings." },
        { status: 403 }
      )
    }

    const body = await request.json()
    if (body?.action !== "reset") {
      return NextResponse.json(
        { error: "Invalid action. Supported action is 'reset'." },
        { status: 400 }
      )
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null

    const result = await resetSystemSettingsToDefaults({
      id: caller.sub,
      email: caller.email,
      role: caller.role,
      ip,
    })

    const updatedSecrets = await getSystemSecretsMetadata()

    return NextResponse.json({
      ...result,
      secrets: updatedSecrets,
    })
  } catch (error) {
    console.error("POST /api/admin/system-settings error:", error)
    return NextResponse.json(
      { error: "Failed to reset system settings" },
      { status: 500 }
    )
  }
}

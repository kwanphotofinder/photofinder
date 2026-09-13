import prisma from "@/lib/prisma"
import { Role } from "@prisma/client"

export interface AuditLogParams {
  actorId?: string | null
  actorEmail: string
  actorRole?: Role | string | null
  action: string
  category: "BIOMETRICS" | "USER_MGMT" | "CONTENT" | "SECURITY"
  targetType?: "USER" | "PHOTO" | "EVENT" | "SYSTEM" | string | null
  targetId?: string | null
  targetLabel?: string | null
  details?: string | null
  ipAddress?: string | null
}

/**
 * Record an audit log event asynchronously and fail-safely.
 * Catches any logging errors without disrupting the core business operation.
 */
export async function recordAuditLog(params: AuditLogParams): Promise<void> {
  try {
    const roleValue = params.actorRole ? (params.actorRole as Role) : null

    await (prisma as any).auditLog.create({
      data: {
        actorId: params.actorId || null,
        actorEmail: params.actorEmail,
        actorRole: roleValue,
        action: params.action,
        category: params.category,
        targetType: params.targetType || null,
        targetId: params.targetId || null,
        targetLabel: params.targetLabel || null,
        details: params.details || null,
        ipAddress: params.ipAddress || null,
      },
    })
  } catch (error) {
    console.error("[AuditLogger] Failed to record audit log:", error)
  }
}

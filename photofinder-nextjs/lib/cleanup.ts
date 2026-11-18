import prisma from "@/lib/prisma"
import { deleteFolderFromCloudinary } from "@/lib/cloudinary"
import { recordAuditLog } from "@/lib/audit-logger"

const AUDIT_LOG_RETENTION_DAYS = 90

export interface CleanupResult {
  deletedCount: number
  deletedIds: string[]
  purgedAuditLogsCount: number
}

/**
 * Deletes expired events (Cloudinary folder first, then the DB row, which cascades to
 * photos, faces, saved photos and reports) and purges audit logs older than 90 days.
 * Safe to run repeatedly: it only touches data that is already past retention.
 *
 * Every deletion is written to the audit log (actor "system") so the admin Logs tab
 * shows exactly what was removed and why.
 */
export async function runCleanup(): Promise<CleanupResult> {
  const expiredEvents = await prisma.event.findMany({
    where: { expiresAt: { lte: new Date() } },
    select: {
      id: true,
      name: true,
      expiresAt: true,
      _count: { select: { photos: true } },
    },
  })

  const deletedIds: string[] = []

  for (const event of expiredEvents) {
    const photoCount = event._count?.photos ?? 0
    try {
      console.log(`[Cleanup] Deleting expired event: ${event.name} (${event.id})`)
      // Cloudinary first: once the DB row is gone we lose the ID and would orphan the files.
      await deleteFolderFromCloudinary(event.id)
      await prisma.event.delete({ where: { id: event.id } })
      deletedIds.push(event.id)

      // Durable record of the deletion (shows in the admin Logs tab).
      await recordAuditLog({
        actorEmail: "system",
        action: "EVENT_CLEANUP_DELETE",
        category: "CONTENT",
        targetType: "EVENT",
        targetId: event.id,
        targetLabel: event.name,
        details: `Auto-deleted by cleanup. Expired ${
          event.expiresAt ? event.expiresAt.toISOString() : "unknown"
        }; removed ${photoCount} photo(s) and their faces/vectors.`,
      })
    } catch (err) {
      console.error(`[Cleanup] Failed to delete event ${event.id}:`, err)
    }
  }

  let purgedAuditLogsCount = 0
  try {
    const cutoff = new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const purgeResult = await (prisma as any).auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    purgedAuditLogsCount = purgeResult.count
    console.log(`[Cleanup] Purged ${purgedAuditLogsCount} audit logs older than ${AUDIT_LOG_RETENTION_DAYS} days.`)
  } catch (auditErr) {
    console.error("[Cleanup] Failed to purge expired audit logs:", auditErr)
  }

  // One summary row per run so the Logs tab shows that a cleanup happened even when
  // nothing was due.
  await recordAuditLog({
    actorEmail: "system",
    action: "CLEANUP_RUN",
    category: "CONTENT",
    targetType: "SYSTEM",
    targetLabel: "Daily cleanup",
    details: `Cleanup finished: ${deletedIds.length} expired event(s) deleted, ${purgedAuditLogsCount} audit log(s) older than ${AUDIT_LOG_RETENTION_DAYS} days purged.`,
  })

  return { deletedCount: deletedIds.length, deletedIds, purgedAuditLogsCount }
}

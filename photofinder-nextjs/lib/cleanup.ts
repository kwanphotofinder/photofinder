import prisma from "@/lib/prisma"
import { deleteFolderFromCloudinary } from "@/lib/cloudinary"

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
 */
export async function runCleanup(): Promise<CleanupResult> {
  const expiredEvents = await prisma.event.findMany({
    where: { expiresAt: { lte: new Date() } },
    select: { id: true, name: true },
  })

  const deletedIds: string[] = []

  for (const event of expiredEvents) {
    try {
      console.log(`[Cleanup] Deleting expired event: ${event.name} (${event.id})`)
      // Cloudinary first: once the DB row is gone we lose the ID and would orphan the files.
      await deleteFolderFromCloudinary(event.id)
      await prisma.event.delete({ where: { id: event.id } })
      deletedIds.push(event.id)
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

  return { deletedCount: deletedIds.length, deletedIds, purgedAuditLogsCount }
}

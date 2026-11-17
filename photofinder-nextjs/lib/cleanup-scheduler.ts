import cron from "node-cron"
import { runCleanup } from "@/lib/cleanup"
import { claimCleanupRun, formatCleanupTime, getCleanupState, latestScheduledRun } from "@/lib/cleanup-settings"

const globalForScheduler = globalThis as typeof globalThis & { __cleanupSchedulerStarted?: boolean }

/**
 * Checks once a minute whether the daily cleanup is due (time is set by the super admin)
 * and runs it. A run missed while the app was down is caught up on the next check.
 */
async function checkAndRun() {
  try {
    const { minutes, lastRunAt } = await getCleanupState()
    const scheduledRun = latestScheduledRun(new Date(), minutes)

    if (lastRunAt && lastRunAt >= scheduledRun) return
    if (!(await claimCleanupRun(scheduledRun))) return // another replica took this run

    console.log(`[CleanupScheduler] Running daily cleanup (scheduled ${formatCleanupTime(minutes)} Asia/Bangkok)`)
    const result = await runCleanup()
    console.log(
      `[CleanupScheduler] Done: ${result.deletedCount} expired events deleted, ${result.purgedAuditLogsCount} audit logs purged.`,
    )
  } catch (error) {
    console.error("[CleanupScheduler] Cleanup check failed:", error)
  }
}

export function startCleanupScheduler() {
  if (globalForScheduler.__cleanupSchedulerStarted) return
  globalForScheduler.__cleanupSchedulerStarted = true

  cron.schedule("* * * * *", checkAndRun, { name: "daily-cleanup", noOverlap: true })
  void checkAndRun() // catch up immediately on boot
  console.log("[CleanupScheduler] Started.")
}

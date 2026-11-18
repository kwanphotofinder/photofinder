import cron from "node-cron"
import { runCleanup } from "@/lib/cleanup"
import { claimCleanupRun, formatCleanupTime, getCleanupState, latestScheduledRun } from "@/lib/cleanup-settings"

const globalForScheduler = globalThis as typeof globalThis & { __cleanupSchedulerStarted?: boolean }

// Cleanup runs ONLY at (or just after) the scheduled time, never as a catch-up.
// A deploy/restart at a random time of day must not trigger a deletion, so we only
// act when the most recent scheduled moment is within this window of "now".
const RUN_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Checks once a minute whether the daily cleanup is due (time is set by the super admin)
 * and runs it — but only within RUN_WINDOW_MS of the scheduled time. If the app was down
 * during that window, the run is skipped for the day (no catch-up, no delete-on-startup).
 */
async function checkAndRun() {
  try {
    const { minutes, lastRunAt } = await getCleanupState()
    const scheduledRun = latestScheduledRun(new Date(), minutes)

    // Only act at the scheduled time; a scheduled moment further in the past is a
    // missed run we deliberately skip (prevents surprise deletions on deploy/restart).
    if (Date.now() - scheduledRun.getTime() > RUN_WINDOW_MS) return

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

  // Per-minute check only. No immediate run on boot: deletions happen strictly at the
  // scheduled time, so deploying or restarting the app never triggers a cleanup.
  cron.schedule("* * * * *", checkAndRun, { name: "daily-cleanup", noOverlap: true })
  console.log("[CleanupScheduler] Started (runs only at the scheduled time).")
}

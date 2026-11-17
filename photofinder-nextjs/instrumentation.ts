// Next.js calls register() once when each server process starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NEXT_PHASE === "phase-production-build") return

  // Runs in production builds by default (off under `next dev`); force with CLEANUP_SCHEDULER_ENABLED=true,
  // or opt out anywhere with CLEANUP_SCHEDULER_ENABLED=false.
  const flag = process.env.CLEANUP_SCHEDULER_ENABLED
  const enabled = flag ? flag === "true" : process.env.NODE_ENV === "production"
  if (!enabled) return

  const { startCleanupScheduler } = await import("./lib/cleanup-scheduler")
  startCleanupScheduler()
}

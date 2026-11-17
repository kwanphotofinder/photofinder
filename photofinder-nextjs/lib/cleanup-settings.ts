import prisma from "@/lib/prisma"

// Stored in the numeric `system_settings` table (no migration needed).
const TIME_KEY = "cleanup_time_minutes" // minutes after midnight, Asia/Bangkok
const LAST_RUN_KEY = "cleanup_last_run_at" // epoch milliseconds of the last claimed run

export const DEFAULT_CLEANUP_TIME_MINUTES = 0 // 00:00
export const CLEANUP_TIMEZONE = "Asia/Bangkok"
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7, no daylight saving
const DAY_MS = 24 * 60 * 60 * 1000

export function isValidCleanupTime(minutes: unknown): minutes is number {
  return Number.isInteger(minutes) && (minutes as number) >= 0 && (minutes as number) < 24 * 60
}

export function formatCleanupTime(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0")
  const mm = String(minutes % 60).padStart(2, "0")
  return `${hh}:${mm}`
}

export async function getCleanupState() {
  const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: number | string }>>(
    `SELECT "key", "value" FROM "system_settings" WHERE "key" IN ($1, $2)`,
    TIME_KEY,
    LAST_RUN_KEY,
  )
  const values = new Map(rows.map((row) => [row.key, Number(row.value)]))
  const storedTime = values.get(TIME_KEY)
  const lastRun = values.get(LAST_RUN_KEY)

  return {
    minutes: isValidCleanupTime(storedTime) ? storedTime : DEFAULT_CLEANUP_TIME_MINUTES,
    lastRunAt: lastRun ? new Date(lastRun) : null,
  }
}

export async function setCleanupTimeMinutes(minutes: number) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "system_settings" ("key", "value")
     VALUES ($1, $2)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP`,
    TIME_KEY,
    minutes,
  )
}

/** The most recent moment (at or before `now`) the cleanup was scheduled to run. */
export function latestScheduledRun(now: Date, minutes: number) {
  const bangkokMidnight = Math.floor((now.getTime() + BANGKOK_OFFSET_MS) / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS
  const todayRun = bangkokMidnight + minutes * 60 * 1000
  return new Date(todayRun <= now.getTime() ? todayRun : todayRun - DAY_MS)
}

/**
 * Atomically marks the run for `scheduledRun` as taken. Returns true for exactly one caller
 * across all app replicas; the others see the updated timestamp and get false.
 */
export async function claimCleanupRun(scheduledRun: Date, now = new Date()) {
  const claimed = await prisma.$queryRawUnsafe<Array<{ key: string }>>(
    `INSERT INTO "system_settings" ("key", "value")
     VALUES ($1, $2)
     ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = CURRENT_TIMESTAMP
     WHERE "system_settings"."value" < $3
     RETURNING "key"`,
    LAST_RUN_KEY,
    now.getTime(),
    scheduledRun.getTime(),
  )
  return claimed.length > 0
}

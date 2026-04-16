import prisma from "@/lib/prisma"

type EngagementAction = "VIEW" | "DOWNLOAD"

let tableReady = false

export async function ensurePhotoEngagementTable() {
  if (tableReady) return

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "photo_engagements" (
      "id" BIGSERIAL PRIMARY KEY,
      "photoId" TEXT NOT NULL,
      "eventId" TEXT NOT NULL,
      "uploaderId" TEXT,
      "viewerId" TEXT,
      "action" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_photo_engagements_uploader_event_action"
    ON "photo_engagements" ("uploaderId", "eventId", "action")
  `)

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_photo_engagements_photo"
    ON "photo_engagements" ("photoId")
  `)

  tableReady = true
}

export async function recordPhotoEngagement(params: {
  photoId: string
  action: EngagementAction
  viewerId?: string | null
}) {
  const photo = await prisma.photo.findUnique({
    where: { id: params.photoId },
    select: { id: true, eventId: true, uploaderId: true },
  })

  if (!photo) {
    return { ok: false as const, error: "Photo not found" }
  }

  await ensurePhotoEngagementTable()

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "photo_engagements" ("photoId", "eventId", "uploaderId", "viewerId", "action")
      VALUES ($1, $2, $3, $4, $5)
    `,
    photo.id,
    photo.eventId,
    photo.uploaderId,
    params.viewerId ?? null,
    params.action,
  )

  return { ok: true as const }
}

export async function getPhotographerAnalytics(uploaderId: string) {
  await ensurePhotoEngagementTable()

  const rows = await prisma.$queryRawUnsafe<Array<{
    eventId: string
    eventName: string
    eventDate: Date
    photoCount: bigint | number
    views: bigint | number
    downloads: bigint | number
  }>>(
    `
      SELECT
        p."eventId" AS "eventId",
        e."name" AS "eventName",
        e."date" AS "eventDate",
        COUNT(DISTINCT p."id") AS "photoCount",
        COALESCE(SUM(CASE WHEN pe."action" = 'VIEW' THEN 1 ELSE 0 END), 0) AS "views",
        COALESCE(SUM(CASE WHEN pe."action" = 'DOWNLOAD' THEN 1 ELSE 0 END), 0) AS "downloads"
      FROM "photos" p
      INNER JOIN "events" e ON e."id" = p."eventId"
      LEFT JOIN "photo_engagements" pe ON pe."photoId" = p."id"
      WHERE p."uploaderId" = $1
      GROUP BY p."eventId", e."name", e."date"
      ORDER BY e."date" DESC
    `,
    uploaderId,
  )

  const eventStats = rows.map((row) => ({
    eventId: row.eventId,
    eventName: row.eventName,
    eventDate: row.eventDate,
    photoCount: Number(row.photoCount || 0),
    views: Number(row.views || 0),
    downloads: Number(row.downloads || 0),
  }))

  const totals = eventStats.reduce(
    (acc, event) => {
      acc.events += 1
      acc.photos += event.photoCount
      acc.views += event.views
      acc.downloads += event.downloads
      return acc
    },
    { events: 0, photos: 0, views: 0, downloads: 0 },
  )

  return { totals, eventStats }
}

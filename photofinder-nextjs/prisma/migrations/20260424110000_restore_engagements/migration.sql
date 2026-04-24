-- CreateTable: Restore PhotoEngagement
CREATE TABLE IF NOT EXISTS "photo_engagements" (
    "id" BIGSERIAL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "viewerId" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_photo_engagements_uploader_event_action" ON "photo_engagements"("uploaderId", "eventId", "action");
CREATE INDEX IF NOT EXISTS "idx_photo_engagements_photo" ON "photo_engagements"("photoId");

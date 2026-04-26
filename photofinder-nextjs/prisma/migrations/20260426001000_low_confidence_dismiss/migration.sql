-- Persist admin moderation decision for low-confidence queue
ALTER TABLE "photos"
ADD COLUMN "lowConfidenceDismissedAt" TIMESTAMP(3),
ADD COLUMN "lowConfidenceDismissedBy" TEXT;

CREATE INDEX IF NOT EXISTS "photos_lowConfidenceDismissedAt_idx"
ON "photos"("lowConfidenceDismissedAt");

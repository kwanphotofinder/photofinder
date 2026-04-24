-- AlterTable: Add emailNotifications and lineUserId
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailNotifications" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lineUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_lineUserId_key" ON "users"("lineUserId");

-- DropTable: Clean up unused table (safe if it doesn't exist)
DROP TABLE IF EXISTS "photo_engagements";

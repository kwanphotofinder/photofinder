-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE INDEX "audit_logs_actorEmail_idx" ON "audit_logs"("actorEmail");

-- CreateTable
CREATE TABLE "log_taps" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "inputPayload" TEXT,
    "outputSummary" TEXT,
    "isError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_taps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_track_logs" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "errorName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "route" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 500,
    "traceId" TEXT,
    "requestBody" TEXT,
    "queryParams" TEXT,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "error_track_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "log_taps_createdAt_idx" ON "log_taps"("createdAt");

-- CreateIndex
CREATE INDEX "log_taps_path_idx" ON "log_taps"("path");

-- CreateIndex
CREATE INDEX "log_taps_statusCode_idx" ON "log_taps"("statusCode");

-- CreateIndex
CREATE INDEX "log_taps_isError_idx" ON "log_taps"("isError");

-- CreateIndex
CREATE INDEX "log_taps_traceId_idx" ON "log_taps"("traceId");

-- CreateIndex
CREATE INDEX "error_track_fingerprint_idx" ON "error_track_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "error_track_status_idx" ON "error_track_logs"("status");

-- CreateIndex
CREATE INDEX "error_track_lastSeenAt_idx" ON "error_track_logs"("lastSeenAt");

-- CreateIndex
CREATE INDEX "error_track_route_idx" ON "error_track_logs"("route");

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN', 'PHOTOGRAPHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'OPENED');

-- CreateEnum
CREATE TYPE "RemovalRequestType" AS ENUM ('DELETE', 'TAKEDOWN', 'PRIVACY');

-- CreateEnum
CREATE TYPE "RemovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pdpaConsent" BOOLEAN NOT NULL DEFAULT false,
    "lineUserId" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "storageUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "mimeType" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faces" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "embedding" vector(512),
    "confidence" DOUBLE PRECISION,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "w" DOUBLE PRECISION,
    "h" DOUBLE PRECISION,

    CONSTRAINT "faces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_faces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "embedding" vector(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_faces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_reports" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "removal_requests" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" "RemovalRequestType" NOT NULL,
    "reason" TEXT,
    "status" "RemovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "removal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_engagements" (
    "id" BIGSERIAL NOT NULL,
    "photoId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "uploaderId" TEXT,
    "viewerId" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_lineUserId_key" ON "users"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_faces_userId_key" ON "user_faces"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_photos_userId_photoId_key" ON "saved_photos"("userId", "photoId");

-- CreateIndex
CREATE INDEX "idx_photo_engagements_uploader_event_action" ON "photo_engagements"("uploaderId", "eventId", "action");

-- CreateIndex
CREATE INDEX "idx_photo_engagements_photo" ON "photo_engagements"("photoId");

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faces" ADD CONSTRAINT "faces_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_faces" ADD CONSTRAINT "user_faces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_photos" ADD CONSTRAINT "saved_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_photos" ADD CONSTRAINT "saved_photos_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "removal_requests" ADD CONSTRAINT "removal_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


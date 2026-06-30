-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');
CREATE TYPE "SyncRunMode" AS ENUM ('DRY_RUN', 'APPLY');
CREATE TYPE "ProductSyncStatus" AS ENUM ('NEW', 'SYNCED', 'OUT_OF_STOCK', 'MISSING', 'ARCHIVED', 'FAILED', 'SKIPPED');
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'SUCCESS');

-- CreateTable
CREATE TABLE "ProductRecord" (
  "id" TEXT NOT NULL,
  "bossId" TEXT NOT NULL,
  "sku" TEXT,
  "upc" TEXT,
  "title" TEXT NOT NULL,
  "vendor" TEXT NOT NULL DEFAULT 'David Yurman',
  "productType" TEXT,
  "priceUsd" DECIMAL(12,2),
  "inStock" BOOLEAN NOT NULL DEFAULT false,
  "stockRaw" TEXT,
  "imageUrl" TEXT,
  "shopifyProductId" TEXT,
  "shopifyHandle" TEXT,
  "shopifyStatus" TEXT,
  "syncStatus" "ProductSyncStatus" NOT NULL DEFAULT 'NEW',
  "missingSince" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductMedia" (
  "id" TEXT NOT NULL,
  "productRecordId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "shopifyMediaId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "lastError" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "mode" "SyncRunMode" NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
  "triggeredBy" TEXT NOT NULL DEFAULT 'manual',
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "totalRaw" INTEGER NOT NULL DEFAULT 0,
  "totalEligible" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "archivedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "missingCount" INTEGER NOT NULL DEFAULT 0,
  "outOfStockCount" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "options" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncEvent" (
  "id" TEXT NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "productRecordId" TEXT,
  "level" "LogLevel" NOT NULL DEFAULT 'INFO',
  "eventType" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductRecord_bossId_key" ON "ProductRecord"("bossId");
CREATE INDEX "ProductRecord_vendor_idx" ON "ProductRecord"("vendor");
CREATE INDEX "ProductRecord_sku_idx" ON "ProductRecord"("sku");
CREATE INDEX "ProductRecord_upc_idx" ON "ProductRecord"("upc");
CREATE INDEX "ProductRecord_shopifyProductId_idx" ON "ProductRecord"("shopifyProductId");
CREATE INDEX "ProductRecord_syncStatus_idx" ON "ProductRecord"("syncStatus");
CREATE INDEX "ProductRecord_lastSeenAt_idx" ON "ProductRecord"("lastSeenAt");
CREATE UNIQUE INDEX "ProductMedia_productRecordId_sourceUrl_key" ON "ProductMedia"("productRecordId", "sourceUrl");
CREATE INDEX "ProductMedia_shopifyMediaId_idx" ON "ProductMedia"("shopifyMediaId");
CREATE INDEX "SyncRun_createdAt_idx" ON "SyncRun"("createdAt");
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");
CREATE INDEX "SyncRun_mode_idx" ON "SyncRun"("mode");
CREATE INDEX "SyncEvent_syncRunId_createdAt_idx" ON "SyncEvent"("syncRunId", "createdAt");
CREATE INDEX "SyncEvent_productRecordId_idx" ON "SyncEvent"("productRecordId");
CREATE INDEX "SyncEvent_level_idx" ON "SyncEvent"("level");

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productRecordId_fkey" FOREIGN KEY ("productRecordId") REFERENCES "ProductRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_productRecordId_fkey" FOREIGN KEY ("productRecordId") REFERENCES "ProductRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

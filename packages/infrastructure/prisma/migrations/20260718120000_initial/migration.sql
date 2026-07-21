-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'AI_ENRICHING', 'AI_READY', 'AI_FAILED');

CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "webhookSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "legalId" TEXT NOT NULL,
    "legalIdNormalized" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "domain" TEXT,
    "normalizedName" TEXT,
    "websiteAlive" BOOLEAN,
    "errorCode" TEXT,
    "errorStage" TEXT,
    "errorReason" TEXT,
    "errorRetryable" BOOLEAN,
    "publicInfo" JSONB,
    "prospectFitScore" INTEGER,
    "fitJustification" TEXT,
    "iceBreaker" TEXT,
    "painHypothesis" TEXT,
    "aiConfidence" TEXT,
    "aiEvidence" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BatchEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "leadId" TEXT,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "statusCode" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Batch_createdAt_idx" ON "Batch"("createdAt");
CREATE INDEX "Lead_batchId_legalIdNormalized_idx" ON "Lead"("batchId", "legalIdNormalized");
CREATE INDEX "Lead_batchId_status_idx" ON "Lead"("batchId", "status");
CREATE INDEX "BatchEvent_batchId_createdAt_idx" ON "BatchEvent"("batchId", "createdAt");
CREATE INDEX "WebhookDelivery_batchId_createdAt_idx" ON "WebhookDelivery"("batchId", "createdAt");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchEvent" ADD CONSTRAINT "BatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BatchEvent" ADD CONSTRAINT "BatchEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

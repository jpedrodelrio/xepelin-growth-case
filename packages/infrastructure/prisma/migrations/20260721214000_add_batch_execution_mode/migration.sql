ALTER TABLE "Batch"
ADD COLUMN "executionMode" TEXT NOT NULL DEFAULT 'demo';

UPDATE "Batch" AS batch
SET "executionMode" = 'live'
WHERE EXISTS (
  SELECT 1
  FROM "Lead" AS lead
  WHERE lead."batchId" = batch.id
    AND lead."aiExecution"->>'mode' = 'live'
)
OR EXISTS (
  SELECT 1
  FROM "WebhookDelivery" AS delivery
  WHERE delivery."batchId" = batch.id
    AND delivery.mode = 'live'
);

ALTER TABLE "Batch"
ADD CONSTRAINT "Batch_executionMode_check"
CHECK ("executionMode" IN ('demo', 'live'));

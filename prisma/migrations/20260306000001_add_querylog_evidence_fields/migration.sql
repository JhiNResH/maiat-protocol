-- AlterTable: add evidence chain fields to query_logs
ALTER TABLE "query_logs" ADD COLUMN IF NOT EXISTS "prevHash" TEXT;
ALTER TABLE "query_logs" ADD COLUMN IF NOT EXISTS "recordHash" TEXT;
ALTER TABLE "query_logs" ADD COLUMN IF NOT EXISTS "outcome" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "query_logs_recordHash_idx" ON "query_logs"("recordHash");

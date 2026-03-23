-- Migration: 1A — QueryLog evidence chain
-- Adds tamper-evident chain fields + outcome tracking to query_logs table.
-- Part of Maiat v2 trust foundation: GET /api/v1/evidence/:address

ALTER TABLE "query_logs"
  ADD COLUMN IF NOT EXISTS "prev_hash"   TEXT,
  ADD COLUMN IF NOT EXISTS "record_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "outcome"     TEXT;

-- Index for evidence chain lookups (target + createdAt)
CREATE INDEX IF NOT EXISTS "query_logs_target_created_at_idx"
  ON "query_logs"("target", "created_at");

COMMENT ON COLUMN "query_logs"."prev_hash"
  IS 'SHA-256 of the previous record_hash for the same target — forms a verifiable chain';
COMMENT ON COLUMN "query_logs"."record_hash"
  IS 'SHA-256(id||type||target||trust_score||verdict||created_at||prev_hash) — tamper-evident';
COMMENT ON COLUMN "query_logs"."outcome"
  IS 'Actual result filled by POST /api/v1/outcome: success|failure|partial|expired';

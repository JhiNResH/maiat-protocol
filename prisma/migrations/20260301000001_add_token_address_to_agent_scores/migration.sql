-- AlterTable: add token_address and token_symbol to agent_scores
-- Applied via prisma db push on 2026-03-01
ALTER TABLE "agent_scores" ADD COLUMN IF NOT EXISTS "token_address" TEXT;
ALTER TABLE "agent_scores" ADD COLUMN IF NOT EXISTS "token_symbol" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_scores_token_address_idx" ON "agent_scores"("token_address");

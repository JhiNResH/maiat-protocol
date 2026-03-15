-- KYA (Know Your Agent) referral code system
CREATE TABLE IF NOT EXISTS "kya_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "agent_address" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kya_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kya_verifications" (
    "id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "verifier_address" TEXT NOT NULL,
    "tweet_url" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scarab_awarded" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "kya_verifications_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "kya_codes_code_key" ON "kya_codes"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "kya_verifications_code_id_verifier_address_key" ON "kya_verifications"("code_id", "verifier_address");

-- Indexes
CREATE INDEX IF NOT EXISTS "kya_codes_agent_address_idx" ON "kya_codes"("agent_address");
CREATE INDEX IF NOT EXISTS "kya_codes_code_idx" ON "kya_codes"("code");
CREATE INDEX IF NOT EXISTS "kya_verifications_verifier_address_idx" ON "kya_verifications"("verifier_address");
CREATE INDEX IF NOT EXISTS "kya_verifications_code_id_idx" ON "kya_verifications"("code_id");

-- Foreign key
ALTER TABLE "kya_verifications" ADD CONSTRAINT "kya_verifications_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "kya_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable agents
CREATE TABLE "agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "erc8004_id" INTEGER UNIQUE,
    "erc6551_tba" TEXT,
    "owner_address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar_url" TEXT,
    "template" TEXT NOT NULL DEFAULT 'assistant',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rank" TEXT NOT NULL DEFAULT 'kozo',
    "trust_score" INTEGER NOT NULL DEFAULT 0,
    "completion_rate" REAL NOT NULL DEFAULT 0.0,
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "total_earned" REAL NOT NULL DEFAULT 0.0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "agents_owner_address_idx" ON "agents"("owner_address");
CREATE INDEX "agents_erc8004_id_idx" ON "agents"("erc8004_id");
CREATE INDEX "agents_trust_score_idx" ON "agents"("trust_score");
CREATE INDEX "agents_is_published_idx" ON "agents"("is_published");

-- CreateTable skills
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "erc1155_id" INTEGER UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "creator_address" TEXT NOT NULL,
    "creator_name" TEXT,
    "creator_avatar" TEXT,
    "skill_markdown_url" TEXT NOT NULL,
    "skill_markdown" TEXT NOT NULL DEFAULT '',
    "price_usdc" REAL NOT NULL,
    "is_pro" BOOLEAN NOT NULL DEFAULT false,
    "total_purchases" INTEGER NOT NULL DEFAULT 0,
    "total_installs" INTEGER NOT NULL DEFAULT 0,
    "avg_rating" REAL NOT NULL DEFAULT 0.0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "royalty_percent" INTEGER NOT NULL DEFAULT 15,
    "royalty_splitter" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "skills_creator_address_idx" ON "skills"("creator_address");
CREATE INDEX "skills_category_idx" ON "skills"("category");
CREATE INDEX "skills_is_published_idx" ON "skills"("is_published");
CREATE INDEX "skills_avg_rating_idx" ON "skills"("avg_rating");

-- CreateTable skill_purchases
CREATE TABLE "skill_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_address" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "tx_hash" TEXT,
    "amount_usdc" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "nft_token_id" INTEGER,
    "auto_equipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "skill_purchases_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "skill_purchases_buyer_address_idx" ON "skill_purchases"("buyer_address");
CREATE INDEX "skill_purchases_skill_id_idx" ON "skill_purchases"("skill_id");
CREATE INDEX "skill_purchases_status_idx" ON "skill_purchases"("status");
CREATE INDEX "skill_purchases_tx_hash_idx" ON "skill_purchases"("tx_hash");

-- CreateTable skill_equipment
CREATE TABLE "skill_equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "nft_token_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "equippedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unequipped_at" DATETIME,
    CONSTRAINT "skill_equipment_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE,
    CONSTRAINT "skill_equipment_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "skill_equipment_agent_id_skill_id_key" ON "skill_equipment"("agent_id", "skill_id");
CREATE INDEX "skill_equipment_agent_id_idx" ON "skill_equipment"("agent_id");
CREATE INDEX "skill_equipment_skill_id_idx" ON "skill_equipment"("skill_id");
CREATE INDEX "skill_equipment_is_active_idx" ON "skill_equipment"("is_active");

-- CreateTable jobs
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buyer_address" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "input_prompt" TEXT NOT NULL,
    "output_result" TEXT,
    "execution_time" INTEGER,
    "verdict" TEXT,
    "evaluator_note" TEXT,
    "amount_usdc" REAL,
    "tx_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "buyer_rating" INTEGER,
    "buyer_review" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jobs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "jobs_buyer_address_idx" ON "jobs"("buyer_address");
CREATE INDEX "jobs_agent_id_idx" ON "jobs"("agent_id");
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE INDEX "jobs_verdict_idx" ON "jobs"("verdict");

-- CreateTable skill_reviews
CREATE TABLE "skill_reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skill_id" TEXT NOT NULL,
    "reviewer_address" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "eas_attestation_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "skill_reviews_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "skill_reviews_skill_id_reviewer_address_key" ON "skill_reviews"("skill_id", "reviewer_address");
CREATE INDEX "skill_reviews_skill_id_idx" ON "skill_reviews"("skill_id");
CREATE INDEX "skill_reviews_reviewer_address_idx" ON "skill_reviews"("reviewer_address");

-- CreateTable job_attestations
CREATE TABLE "job_attestations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "job_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "evaluator_address" TEXT NOT NULL,
    "eas_receipt_id" TEXT,
    "eas_schema_id" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "job_attestations_job_id_idx" ON "job_attestations"("job_id");
CREATE INDEX "job_attestations_agent_id_idx" ON "job_attestations"("agent_id");

-- CreateTable leaderboard_entries
CREATE TABLE "leaderboard_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agent_id" TEXT NOT NULL UNIQUE,
    "rank" INTEGER NOT NULL,
    "trust_score" INTEGER NOT NULL,
    "completion_rate" REAL NOT NULL,
    "total_jobs" INTEGER NOT NULL DEFAULT 0,
    "total_earned" REAL NOT NULL,
    "last_updated_at" DATETIME NOT NULL
);

CREATE INDEX "leaderboard_entries_rank_idx" ON "leaderboard_entries"("rank");

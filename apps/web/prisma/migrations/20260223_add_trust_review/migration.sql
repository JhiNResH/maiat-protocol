-- CreateTable: TrustReview (MAIAT v1 Review API — 0-10 scale)
CREATE TABLE IF NOT EXISTS "TrustReview" (
    "id"        TEXT NOT NULL,
    "address"   TEXT NOT NULL,
    "rating"    INTEGER NOT NULL,
    "comment"   TEXT NOT NULL DEFAULT '',
    "tags"      TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewer"  TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TrustReview_address_idx" ON "TrustReview"("address");
CREATE INDEX IF NOT EXISTS "TrustReview_reviewer_idx" ON "TrustReview"("reviewer");
CREATE INDEX IF NOT EXISTS "TrustReview_createdAt_idx" ON "TrustReview"("createdAt");

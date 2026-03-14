-- CreateTable: Passport (Agent Identity Layer)
CREATE TABLE "passports" (
    "id" TEXT NOT NULL,
    "ensName" TEXT,
    "clientId" TEXT,
    "walletAddress" TEXT,
    "ownerAddress" TEXT,
    "acpAgentId" TEXT,
    "erc8004Id" TEXT,
    "name" TEXT,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'agent',
    "status" TEXT NOT NULL DEFAULT 'unclaimed',
    "avatarUrl" TEXT,
    "trustScore" INTEGER NOT NULL DEFAULT 30,
    "scarabBalance" INTEGER NOT NULL DEFAULT 10,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "totalOutcomes" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "claimTweetUrl" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "passports_ensName_key" ON "passports"("ensName");
CREATE UNIQUE INDEX "passports_clientId_key" ON "passports"("clientId");
CREATE UNIQUE INDEX "passports_walletAddress_key" ON "passports"("walletAddress");
CREATE UNIQUE INDEX "passports_acpAgentId_key" ON "passports"("acpAgentId");
CREATE UNIQUE INDEX "passports_referralCode_key" ON "passports"("referralCode");
CREATE INDEX "passports_walletAddress_idx" ON "passports"("walletAddress");
CREATE INDEX "passports_clientId_idx" ON "passports"("clientId");
CREATE INDEX "passports_status_idx" ON "passports"("status");
CREATE INDEX "passports_trustScore_idx" ON "passports"("trustScore");
CREATE INDEX "passports_ensName_idx" ON "passports"("ensName");

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "totalPool" INTEGER NOT NULL DEFAULT 0,
    "winnerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPosition" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Market_category_idx" ON "Market"("category");

-- CreateIndex
CREATE INDEX "Market_closesAt_idx" ON "Market"("closesAt");

-- CreateIndex
CREATE INDEX "MarketPosition_marketId_idx" ON "MarketPosition"("marketId");

-- CreateIndex
CREATE INDEX "MarketPosition_projectId_idx" ON "MarketPosition"("projectId");

-- CreateIndex
CREATE INDEX "MarketPosition_voterId_idx" ON "MarketPosition"("voterId");

-- AddForeignKey
ALTER TABLE "MarketPosition" ADD CONSTRAINT "MarketPosition_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

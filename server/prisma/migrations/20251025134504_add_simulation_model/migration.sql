-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "allocatedFunds" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "losingTrades" INTEGER NOT NULL DEFAULT 0,
    "totalPnL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "strategies" JSONB,
    "simulationOrders" JSONB,
    "simulationPositions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "simulations_userId_key" ON "simulations"("userId");

-- CreateIndex
CREATE INDEX "alerts_idempotencyKey_idx" ON "alerts"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

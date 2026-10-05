-- Adds a ledger for successful NedarimPlus transactions that don't match
-- anything our own system generated (other payment links, pre-existing
-- standing orders, etc.), plus a FAILURE_EMAIL reason for follow-ups sourced
-- from a parsed NedarimPlus decline notification. Purely additive.

-- AlterEnum
ALTER TYPE "FollowUpReason" ADD VALUE 'FAILURE_EMAIL';

-- CreateTable
CREATE TABLE "ExternalTransaction" (
    "id" TEXT NOT NULL,
    "nedarimTransactionId" TEXT,
    "amountAgorot" INTEGER NOT NULL,
    "clientName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "groupe" TEXT,
    "comments" TEXT,
    "confirmation" TEXT,
    "kevaId" TEXT,
    "rawPayload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalTransaction_nedarimTransactionId_key" ON "ExternalTransaction"("nedarimTransactionId");
CREATE INDEX "ExternalTransaction_receivedAt_idx" ON "ExternalTransaction"("receivedAt");

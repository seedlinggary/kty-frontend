-- Adds donations, recurring memberships, admin fixed-amount payment links, and
-- payment-failure follow-up tracking. Purely additive except for widening
-- Transaction.billId to nullable (a Transaction can now belong to a Donation,
-- Membership, or PaymentLink instead of a Bill) - no existing data is touched,
-- every existing Transaction row keeps its billId exactly as it was.

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPERADMIN');
CREATE TYPE "MembershipTier" AS ENUM ('ASSOCIATE', 'FULL');
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "FollowUpReason" AS ENUM ('STALE_PENDING', 'MANUAL');
CREATE TYPE "FollowUpStatus" AS ENUM ('OPEN', 'EMAIL_SENT', 'RESOLVED', 'DISMISSED');

-- AlterTable: Admin gets a role (existing rows default to ADMIN)
ALTER TABLE "Admin" ADD COLUMN "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';

-- AlterTable: Transaction.billId widened to nullable, plus 3 new nullable FKs
ALTER TABLE "Transaction" ALTER COLUMN "billId" DROP NOT NULL;
ALTER TABLE "Transaction" ADD COLUMN "donationId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "membershipId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "paymentLinkId" TEXT;

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "amountAgorot" INTEGER NOT NULL,
    "purpose" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "tier" "MembershipTier" NOT NULL,
    "monthlyAgorot" INTEGER NOT NULL,
    "kevaId" TEXT,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "nextChargeDate" TIMESTAMP(3),
    "lastChargeAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "amountAgorot" INTEGER NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentFollowUp" (
    "id" TEXT NOT NULL,
    "billId" TEXT,
    "donationId" TEXT,
    "membershipId" TEXT,
    "paymentLinkId" TEXT,
    "reason" "FollowUpReason" NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "emailsSentCount" INTEGER NOT NULL DEFAULT 0,
    "lastEmailSentAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Donation_referenceCode_key" ON "Donation"("referenceCode");
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

CREATE UNIQUE INDEX "Membership_referenceCode_key" ON "Membership"("referenceCode");
CREATE UNIQUE INDEX "Membership_kevaId_key" ON "Membership"("kevaId");
CREATE INDEX "Membership_status_idx" ON "Membership"("status");

CREATE UNIQUE INDEX "PaymentLink_referenceCode_key" ON "PaymentLink"("referenceCode");
CREATE INDEX "PaymentLink_status_idx" ON "PaymentLink"("status");

CREATE INDEX "Transaction_donationId_idx" ON "Transaction"("donationId");
CREATE INDEX "Transaction_membershipId_idx" ON "Transaction"("membershipId");
CREATE INDEX "Transaction_paymentLinkId_idx" ON "Transaction"("paymentLinkId");
CREATE INDEX "Transaction_nedarimTransactionId_idx" ON "Transaction"("nedarimTransactionId");

CREATE INDEX "PaymentFollowUp_billId_idx" ON "PaymentFollowUp"("billId");
CREATE INDEX "PaymentFollowUp_donationId_idx" ON "PaymentFollowUp"("donationId");
CREATE INDEX "PaymentFollowUp_membershipId_idx" ON "PaymentFollowUp"("membershipId");
CREATE INDEX "PaymentFollowUp_paymentLinkId_idx" ON "PaymentFollowUp"("paymentLinkId");
CREATE INDEX "PaymentFollowUp_status_idx" ON "PaymentFollowUp"("status");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "PaymentLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentFollowUp" ADD CONSTRAINT "PaymentFollowUp_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFollowUp" ADD CONSTRAINT "PaymentFollowUp_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFollowUp" ADD CONSTRAINT "PaymentFollowUp_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentFollowUp" ADD CONSTRAINT "PaymentFollowUp_paymentLinkId_fkey" FOREIGN KEY ("paymentLinkId") REFERENCES "PaymentLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

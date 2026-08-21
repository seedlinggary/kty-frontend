-- Restructure: Signup used to be one row per payment (one holiday, one family, one payment).
-- Now a Bill is one payment (contact info, amount, status, NedarimPlus reference code) that
-- owns one or more Signup line items (one per holiday selected in that payment). This migration
-- preserves every existing row: one Bill is created per existing Signup, carrying over all of its
-- contact/payment fields, and existing Transaction rows are re-pointed from Signup to Bill.

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "isMember" BOOLEAN NOT NULL,
    "notes" TEXT,
    "totalAgorot" INTEGER NOT NULL,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_referenceCode_key" ON "Bill"("referenceCode");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- Data migration: one Bill per existing Signup, carrying its old billId as referenceCode
INSERT INTO "Bill" ("id", "referenceCode", "fullName", "phone", "email", "isMember", "notes", "totalAgorot", "status", "createdBy", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "billId", "fullName", "phone", "email", "isMember", "notes", "totalAgorot", "status"::text::"BillStatus", "createdBy", "createdAt", "updatedAt"
FROM "Signup";

-- Rename the old Signup.billId (unique code, now on Bill.referenceCode) out of the way so the
-- new FK column below can use the same name.
ALTER TABLE "Signup" RENAME COLUMN "billId" TO "oldBillCode";

-- Add new FK column pointing at Bill, nullable until populated below.
ALTER TABLE "Signup" ADD COLUMN "billId" TEXT;

UPDATE "Signup"
SET "billId" = "Bill"."id"
FROM "Bill"
WHERE "Bill"."referenceCode" = "Signup"."oldBillCode";

ALTER TABLE "Signup" ALTER COLUMN "billId" SET NOT NULL;

-- Drop the columns that moved up to Bill.
DROP INDEX IF EXISTS "Signup_billId_key";
DROP INDEX IF EXISTS "Signup_status_idx";
ALTER TABLE "Signup" DROP COLUMN "oldBillCode";
ALTER TABLE "Signup" DROP COLUMN "fullName";
ALTER TABLE "Signup" DROP COLUMN "phone";
ALTER TABLE "Signup" DROP COLUMN "email";
ALTER TABLE "Signup" DROP COLUMN "isMember";
ALTER TABLE "Signup" DROP COLUMN "status";
ALTER TABLE "Signup" DROP COLUMN "notes";
ALTER TABLE "Signup" DROP COLUMN "createdBy";

-- AddForeignKey
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Signup_billId_holidayId_key" ON "Signup"("billId", "holidayId");

-- Point Transaction at Bill instead of Signup (one payment confirmation covers the whole bill).
ALTER TABLE "Transaction" ADD COLUMN "billId" TEXT;

UPDATE "Transaction"
SET "billId" = "Signup"."billId"
FROM "Signup"
WHERE "Signup"."id" = "Transaction"."signupId";

ALTER TABLE "Transaction" ALTER COLUMN "billId" SET NOT NULL;

ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_signupId_fkey";
DROP INDEX IF EXISTS "Transaction_signupId_idx";
ALTER TABLE "Transaction" DROP COLUMN "signupId";

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Transaction_billId_idx" ON "Transaction"("billId");

-- DropEnum
DROP TYPE IF EXISTS "SignupStatus";

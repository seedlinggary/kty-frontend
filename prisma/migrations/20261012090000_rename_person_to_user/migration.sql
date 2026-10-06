-- Renames the Person entity to User - a pure rename for clarity, no
-- behavior change. Every row, relationship, and value is untouched; only
-- the table, its columns, and their indexes/constraints change name.

ALTER TABLE "Person" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "Person_pkey" TO "User_pkey";
ALTER INDEX "Person_email_idx" RENAME TO "User_email_idx";

ALTER TABLE "Bill" RENAME COLUMN "personId" TO "userId";
ALTER INDEX "Bill_personId_idx" RENAME TO "Bill_userId_idx";
ALTER TABLE "Bill" RENAME CONSTRAINT "Bill_personId_fkey" TO "Bill_userId_fkey";

ALTER TABLE "Donation" RENAME COLUMN "personId" TO "userId";
ALTER INDEX "Donation_personId_idx" RENAME TO "Donation_userId_idx";
ALTER TABLE "Donation" RENAME CONSTRAINT "Donation_personId_fkey" TO "Donation_userId_fkey";

ALTER TABLE "Membership" RENAME COLUMN "personId" TO "userId";
ALTER INDEX "Membership_personId_idx" RENAME TO "Membership_userId_idx";
ALTER TABLE "Membership" RENAME CONSTRAINT "Membership_personId_fkey" TO "Membership_userId_fkey";

ALTER TABLE "PaymentLink" RENAME COLUMN "personId" TO "userId";
ALTER INDEX "PaymentLink_personId_idx" RENAME TO "PaymentLink_userId_idx";
ALTER TABLE "PaymentLink" RENAME CONSTRAINT "PaymentLink_personId_fkey" TO "PaymentLink_userId_fkey";

ALTER TABLE "FormResponse" RENAME COLUMN "personId" TO "userId";
ALTER INDEX "FormResponse_personId_idx" RENAME TO "FormResponse_userId_idx";
ALTER TABLE "FormResponse" RENAME CONSTRAINT "FormResponse_personId_fkey" TO "FormResponse_userId_fkey";

ALTER TABLE "ExternalTransaction" RENAME COLUMN "personId" TO "userId";
ALTER INDEX "ExternalTransaction_personId_idx" RENAME TO "ExternalTransaction_userId_idx";
ALTER TABLE "ExternalTransaction" RENAME CONSTRAINT "ExternalTransaction_personId_fkey" TO "ExternalTransaction_userId_fkey";

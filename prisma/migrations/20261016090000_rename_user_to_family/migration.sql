-- "User" -> "Family": the same real household (e.g. a husband and wife who
-- each filled out a separate form/bill under their own name/email) is
-- combined under one of these, not one per individual signup. "User" read
-- as if it meant an admin login - "Family" says what it actually is.
ALTER TABLE "User" RENAME TO "Family";
ALTER TABLE "Family" RENAME CONSTRAINT "User_pkey" TO "Family_pkey";
ALTER INDEX "User_email_idx" RENAME TO "Family_email_idx";

ALTER TABLE "Bill" RENAME COLUMN "userId" TO "familyId";
ALTER TABLE "Bill" RENAME CONSTRAINT "Bill_userId_fkey" TO "Bill_familyId_fkey";
ALTER INDEX "Bill_userId_idx" RENAME TO "Bill_familyId_idx";

ALTER TABLE "Donation" RENAME COLUMN "userId" TO "familyId";
ALTER TABLE "Donation" RENAME CONSTRAINT "Donation_userId_fkey" TO "Donation_familyId_fkey";
ALTER INDEX "Donation_userId_idx" RENAME TO "Donation_familyId_idx";

ALTER TABLE "Membership" RENAME COLUMN "userId" TO "familyId";
ALTER TABLE "Membership" RENAME CONSTRAINT "Membership_userId_fkey" TO "Membership_familyId_fkey";
ALTER INDEX "Membership_userId_idx" RENAME TO "Membership_familyId_idx";

ALTER TABLE "PaymentLink" RENAME COLUMN "userId" TO "familyId";
ALTER TABLE "PaymentLink" RENAME CONSTRAINT "PaymentLink_userId_fkey" TO "PaymentLink_familyId_fkey";
ALTER INDEX "PaymentLink_userId_idx" RENAME TO "PaymentLink_familyId_idx";

ALTER TABLE "FormResponse" RENAME COLUMN "userId" TO "familyId";
ALTER TABLE "FormResponse" RENAME CONSTRAINT "FormResponse_userId_fkey" TO "FormResponse_familyId_fkey";
ALTER INDEX "FormResponse_userId_idx" RENAME TO "FormResponse_familyId_idx";

ALTER TABLE "ExternalTransaction" RENAME COLUMN "userId" TO "familyId";
ALTER TABLE "ExternalTransaction" RENAME CONSTRAINT "ExternalTransaction_userId_fkey" TO "ExternalTransaction_familyId_fkey";
ALTER INDEX "ExternalTransaction_userId_idx" RENAME TO "ExternalTransaction_familyId_idx";

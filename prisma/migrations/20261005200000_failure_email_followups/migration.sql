-- Adds standalone-follow-up support (for a decline on something our system
-- never created) plus diagnostic fields parsed from a NedarimPlus decline
-- email. Purely additive - new nullable columns only.

ALTER TABLE "PaymentFollowUp" ADD COLUMN "externalFullName" TEXT;
ALTER TABLE "PaymentFollowUp" ADD COLUMN "externalPhone" TEXT;
ALTER TABLE "PaymentFollowUp" ADD COLUMN "externalEmail" TEXT;
ALTER TABLE "PaymentFollowUp" ADD COLUMN "externalAmountAgorot" INTEGER;
ALTER TABLE "PaymentFollowUp" ADD COLUMN "externalCategory" TEXT;
ALTER TABLE "PaymentFollowUp" ADD COLUMN "externalKevaId" TEXT;
ALTER TABLE "PaymentFollowUp" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "PaymentFollowUp" ADD COLUMN "cardLast4" TEXT;

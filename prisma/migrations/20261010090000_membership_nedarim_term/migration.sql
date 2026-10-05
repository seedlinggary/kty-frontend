-- Snapshot fields from NedarimPlus's per-standing-order detail report
-- (KevaSuccess / KevaTashlumim), populated only when a membership is
-- imported from (or re-synced against) a pre-existing NedarimPlus standing
-- order. Purely informational - additive and nullable.

ALTER TABLE "Membership" ADD COLUMN "nedarimPaymentsMade" INTEGER;
ALTER TABLE "Membership" ADD COLUMN "nedarimPaymentsRemaining" INTEGER;

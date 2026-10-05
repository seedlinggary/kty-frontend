-- Adds an optional city field alongside address, so each maps 1:1 onto
-- NedarimPlus's own Street/City payment-link params (previously we collected
-- an address but never actually passed it through to NedarimPlus at all).

ALTER TABLE "Donation" ADD COLUMN "city" TEXT;
ALTER TABLE "Membership" ADD COLUMN "city" TEXT;

-- Flags a Transaction whose amountAgorot is our own fallback guess (the
-- membership's recurring rate) rather than a real amount NedarimPlus
-- reported for that specific charge. Defaults false for every existing
-- row; the next "Import from NedarimPlus" re-sync backfills it correctly
-- for already-imported history (see lib/actions/nedarim-import.ts).

ALTER TABLE "Transaction" ADD COLUMN "amountIsEstimated" BOOLEAN NOT NULL DEFAULT false;

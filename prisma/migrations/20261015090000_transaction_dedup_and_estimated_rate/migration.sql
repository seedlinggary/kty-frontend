-- Close a dedup race: two near-simultaneous webhook deliveries for the same
-- NedarimPlus charge could both pass the app-level "does this
-- nedarimTransactionId already exist" check before either insert finished,
-- creating a duplicate Transaction. A unique constraint makes the database
-- itself the backstop, not just application logic. NULLs are unaffected -
-- Postgres allows any number of rows with a NULL in a unique column.
-- IF EXISTS / IF NOT EXISTS throughout: Postgres runs each statement in a
-- migration.sql as its own step, not one all-or-nothing transaction, so a
-- failure partway through (confirmed: this one failed on ADD CONSTRAINT
-- after DROP INDEX had already succeeded) leaves a partial state that a
-- retry of the original statements can't safely resume from. Idempotent
-- either way - a fresh environment applying this for the first time behaves
-- identically.
DROP INDEX IF EXISTS "Transaction_nedarimTransactionId_idx";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_nedarimTransactionId_key" UNIQUE ("nedarimTransactionId");

-- Marks a membership imported from NedarimPlus whose standing-order listing
-- didn't report a usable Amount at all, so monthlyAgorot is a placeholder
-- (0) rather than a confirmed rate - same disclosure pattern as
-- Transaction.amountIsEstimated.
ALTER TABLE "Membership" ADD COLUMN IF NOT EXISTS "monthlyAgorotIsEstimated" BOOLEAN NOT NULL DEFAULT false;

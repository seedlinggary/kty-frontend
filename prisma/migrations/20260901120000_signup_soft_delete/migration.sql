-- Adds soft-delete support to Signup line items. Nullable, no default, no
-- backfill needed - every existing row simply has deletedAt = NULL (not deleted).

-- AlterTable
ALTER TABLE "Signup" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Signup_deletedAt_idx" ON "Signup"("deletedAt");

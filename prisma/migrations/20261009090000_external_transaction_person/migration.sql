-- Link ExternalTransaction into the Person-merging feature too, so a
-- recommended match against an "other transaction" can actually be acted
-- on, not just displayed. Same pattern as every other mergeable model:
-- nullable FK, ON DELETE SET NULL.

ALTER TABLE "ExternalTransaction" ADD COLUMN "personId" TEXT;

CREATE INDEX "ExternalTransaction_personId_idx" ON "ExternalTransaction"("personId");

ALTER TABLE "ExternalTransaction" ADD CONSTRAINT "ExternalTransaction_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

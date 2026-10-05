-- Link FormResponse into the Person-merging feature, same pattern as
-- Bill/Donation/Membership/PaymentLink: nullable FK, ON DELETE SET NULL, so
-- merging/unmerging never deletes or alters a FormResponse itself.

ALTER TABLE "FormResponse" ADD COLUMN "personId" TEXT;

CREATE INDEX "FormResponse_personId_idx" ON "FormResponse"("personId");

ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Adds a Person entity that Bills/Donations/Memberships/PaymentLinks can
-- optionally be merged onto from the admin Search page, so the same real
-- individual's repeated NedarimPlus signups show as one combined history
-- instead of unrelated scattered records. Purely additive - nothing is
-- required to have a personId, and deleting a Person only unlinks its
-- records (ON DELETE SET NULL), never deletes them.

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Person_email_idx" ON "Person"("email");

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN "personId" TEXT;
ALTER TABLE "Donation" ADD COLUMN "personId" TEXT;
ALTER TABLE "Membership" ADD COLUMN "personId" TEXT;
ALTER TABLE "PaymentLink" ADD COLUMN "personId" TEXT;

CREATE INDEX "Bill_personId_idx" ON "Bill"("personId");
CREATE INDEX "Donation_personId_idx" ON "Donation"("personId");
CREATE INDEX "Membership_personId_idx" ON "Membership"("personId");
CREATE INDEX "PaymentLink_personId_idx" ON "PaymentLink"("personId");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

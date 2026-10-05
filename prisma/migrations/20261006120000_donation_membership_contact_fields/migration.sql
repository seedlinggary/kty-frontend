-- Donations and memberships: email becomes mandatory (the one reliable way
-- to reach someone about a failed payment), phone becomes optional, and a
-- new optional address field is added. Backfills any existing NULL emails
-- with a placeholder first so the NOT NULL constraint can't fail on old
-- test/dev data - no real row's data is lost, nothing is deleted.

UPDATE "Donation" SET email = 'unknown@example.com' WHERE email IS NULL;
UPDATE "Membership" SET email = 'unknown@example.com' WHERE email IS NULL;

ALTER TABLE "Donation" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "Donation" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Donation" ADD COLUMN "address" TEXT;

ALTER TABLE "Membership" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "Membership" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Membership" ADD COLUMN "address" TEXT;

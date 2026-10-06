-- Tracks whether a real NedarimPlus DeleteKeva/DisableKeva API call has
-- actually succeeded against the live standing order - separate from our
-- own Cancel button, which only ever changes local status. Purely
-- additive and nullable; never a reason to delete the Membership row
-- itself.

ALTER TABLE "Membership" ADD COLUMN "nedarimDeletedAt" TIMESTAMP(3);
ALTER TABLE "Membership" ADD COLUMN "nedarimDisabledAt" TIMESTAMP(3);

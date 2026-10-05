import type { MembershipTier } from "@/lib/generated/prisma/client";

export const MEMBERSHIP_PRICES_AGOROT: Record<MembershipTier, number> = {
  ASSOCIATE: 10000, // 100 shekel/month
  FULL: 20000, // 200 shekel/month
};

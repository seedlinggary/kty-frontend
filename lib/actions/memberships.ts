"use server";

import { prisma } from "@/lib/prisma";
import { buildRecurringPaymentLink } from "@/lib/nedarim";
import { generateBillId } from "@/lib/billid";
import { MEMBERSHIP_PRICES_AGOROT } from "@/lib/memberships";
import type { MembershipTier } from "@/lib/generated/prisma/client";

export type CreateMembershipInput = {
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  tier: MembershipTier;
  locale?: "en" | "he";
  createdBy?: string;
};

export type CreateMembershipResult =
  | { ok: true; membershipId: string; monthlyAgorot: number; paymentLink: string | null }
  | { ok: false; error: "missing_fields" };

export async function createMembership(
  input: CreateMembershipInput
): Promise<CreateMembershipResult> {
  const fullName = input.fullName?.trim();
  const email = input.email?.trim();
  if (!fullName || !email) return { ok: false, error: "missing_fields" };

  const monthlyAgorot = MEMBERSHIP_PRICES_AGOROT[input.tier];

  const membership = await prisma.membership.create({
    data: {
      referenceCode: generateBillId(),
      fullName,
      email,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      tier: input.tier,
      monthlyAgorot,
      createdBy: input.createdBy ?? "public",
    },
  });

  const locale = input.locale ?? "en";
  const tierLabel =
    input.tier === "FULL"
      ? locale === "he" ? "חברות מלאה" : "Full Membership"
      : locale === "he" ? "חברות משויכת" : "Associate Membership";

  const paymentLink = buildRecurringPaymentLink({
    membershipId: membership.referenceCode,
    monthlyAmountAgorot: monthlyAgorot,
    clientName: membership.fullName,
    phone: membership.phone,
    email: membership.email,
    street: membership.address,
    city: membership.city,
    groupe: tierLabel,
    language: locale,
  });

  return { ok: true, membershipId: membership.referenceCode, monthlyAgorot, paymentLink };
}

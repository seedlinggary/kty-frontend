"use server";

import { prisma } from "@/lib/prisma";
import { buildPaymentLink } from "@/lib/nedarim";
import { generateBillId } from "@/lib/billid";
import { shekelsToAgorot } from "@/lib/money";

export type CreateDonationInput = {
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  amountShekels: number;
  purpose?: string;
  locale?: "en" | "he";
  createdBy?: string;
};

export type CreateDonationResult =
  | { ok: true; donationId: string; amountAgorot: number; paymentLink: string | null }
  | { ok: false; error: "missing_fields" | "invalid_amount" };

export async function createDonation(input: CreateDonationInput): Promise<CreateDonationResult> {
  const fullName = input.fullName?.trim();
  const email = input.email?.trim();
  if (!fullName || !email) return { ok: false, error: "missing_fields" };

  const amountAgorot = shekelsToAgorot(Number(input.amountShekels) || 0);
  if (amountAgorot < 1) return { ok: false, error: "invalid_amount" };

  const donation = await prisma.donation.create({
    data: {
      referenceCode: generateBillId(),
      fullName,
      email,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      amountAgorot,
      purpose: input.purpose?.trim() || null,
      createdBy: input.createdBy ?? "public",
    },
  });

  const locale = input.locale ?? "en";
  const groupe = donation.purpose
    ? (locale === "he" ? `תרומה - ${donation.purpose}` : `Donation - ${donation.purpose}`)
    : locale === "he"
      ? "תרומה"
      : "Donation";

  const paymentLink = buildPaymentLink({
    billId: donation.referenceCode,
    amountAgorot,
    clientName: donation.fullName,
    phone: donation.phone,
    email: donation.email,
    street: donation.address,
    city: donation.city,
    groupe,
    language: locale,
    referencePrefix: "DON",
    redirectParam: "donation",
  });

  return { ok: true, donationId: donation.referenceCode, amountAgorot, paymentLink };
}

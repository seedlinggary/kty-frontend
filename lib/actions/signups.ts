"use server";

import { prisma } from "@/lib/prisma";
import { computeTotalAgorot } from "@/lib/holidays";
import { buildPaymentLink } from "@/lib/nedarim";
import { generateBillId } from "@/lib/billid";

export type CreateSignupInput = {
  holidaySlug: string;
  fullName: string;
  phone: string;
  email?: string;
  isMember: boolean;
  menSeats: number;
  womenSeats: number;
  notes?: string;
  locale?: "en" | "he";
  createdBy?: string;
};

export type CreateSignupResult =
  | { ok: true; billId: string; totalAgorot: number; paymentLink: string | null }
  | { ok: false; error: "holiday_not_open" | "no_seats" | "missing_fields" };

export async function createSignup(input: CreateSignupInput): Promise<CreateSignupResult> {
  const holiday = await prisma.holiday.findUnique({ where: { slug: input.holidaySlug } });
  if (!holiday || !holiday.isOpen) return { ok: false, error: "holiday_not_open" };

  const menSeats = Math.max(0, Math.floor(Number(input.menSeats)) || 0);
  const womenSeats = Math.max(0, Math.floor(Number(input.womenSeats)) || 0);
  if (menSeats + womenSeats < 1) return { ok: false, error: "no_seats" };

  const fullName = input.fullName?.trim();
  const phone = input.phone?.trim();
  if (!fullName || !phone) return { ok: false, error: "missing_fields" };

  const totalAgorot = computeTotalAgorot(holiday, input.isMember, menSeats, womenSeats);

  const signup = await prisma.signup.create({
    data: {
      billId: generateBillId(),
      holidayId: holiday.id,
      fullName,
      phone,
      email: input.email?.trim() || null,
      isMember: input.isMember,
      menSeats,
      womenSeats,
      totalAgorot,
      notes: input.notes?.trim() || null,
      createdBy: input.createdBy ?? "public",
    },
  });

  const locale = input.locale ?? "en";
  const paymentLink = buildPaymentLink({
    billId: signup.billId,
    amountAgorot: totalAgorot,
    clientName: signup.fullName,
    phone: signup.phone,
    email: signup.email,
    groupe: locale === "he" ? holiday.nameHe : holiday.nameEn,
    language: locale,
  });

  return { ok: true, billId: signup.billId, totalAgorot, paymentLink };
}

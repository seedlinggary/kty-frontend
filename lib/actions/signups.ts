"use server";

import { prisma } from "@/lib/prisma";
import { computeTotalAgorot } from "@/lib/holidays";
import { buildPaymentLink } from "@/lib/nedarim";
import { generateBillId } from "@/lib/billid";

export type BillLineItemInput = {
  holidaySlug: string;
  menSeats: number;
  womenSeats: number;
};

export type CreateBillInput = {
  fullName: string;
  phone: string;
  email?: string;
  isMember: boolean;
  notes?: string;
  lineItems: BillLineItemInput[];
  locale?: "en" | "he";
  createdBy?: string;
};

export type CreateBillResult =
  | { ok: true; billId: string; totalAgorot: number; paymentLink: string | null }
  | { ok: false; error: "no_open_holidays" | "no_seats" | "missing_fields" };

export async function createBill(input: CreateBillInput): Promise<CreateBillResult> {
  const fullName = input.fullName?.trim();
  const phone = input.phone?.trim();
  if (!fullName || !phone) return { ok: false, error: "missing_fields" };

  // Only keep line items with at least one seat selected, and only for holidays
  // that are still open right now (re-checked server-side - a holiday could have
  // closed between page load and submit).
  const requestedSlugs = input.lineItems
    .filter((item) => Math.max(0, Math.floor(Number(item.menSeats)) || 0) + Math.max(0, Math.floor(Number(item.womenSeats)) || 0) > 0)
    .map((item) => item.holidaySlug);

  if (requestedSlugs.length === 0) return { ok: false, error: "no_seats" };

  const holidays = await prisma.holiday.findMany({
    where: { slug: { in: requestedSlugs }, isOpen: true },
  });
  if (holidays.length === 0) return { ok: false, error: "no_open_holidays" };
  const holidaysBySlug = new Map(holidays.map((h) => [h.slug, h]));

  const lineItemsToCreate: {
    holidayId: string;
    menSeats: number;
    womenSeats: number;
    totalAgorot: number;
  }[] = [];

  for (const item of input.lineItems) {
    const menSeats = Math.max(0, Math.floor(Number(item.menSeats)) || 0);
    const womenSeats = Math.max(0, Math.floor(Number(item.womenSeats)) || 0);
    if (menSeats + womenSeats < 1) continue;

    const holiday = holidaysBySlug.get(item.holidaySlug);
    if (!holiday) continue; // closed or unknown - silently dropped, already re-validated above

    lineItemsToCreate.push({
      holidayId: holiday.id,
      menSeats,
      womenSeats,
      totalAgorot: computeTotalAgorot(holiday, input.isMember, menSeats, womenSeats),
    });
  }

  if (lineItemsToCreate.length === 0) return { ok: false, error: "no_open_holidays" };

  const totalAgorot = lineItemsToCreate.reduce((sum, item) => sum + item.totalAgorot, 0);

  const bill = await prisma.bill.create({
    data: {
      referenceCode: generateBillId(),
      fullName,
      phone,
      email: input.email?.trim() || null,
      isMember: input.isMember,
      notes: input.notes?.trim() || null,
      totalAgorot,
      createdBy: input.createdBy ?? "public",
      lineItems: { create: lineItemsToCreate },
    },
    include: { lineItems: { include: { holiday: true } } },
  });

  const locale = input.locale ?? "en";
  const groupe = bill.lineItems
    .map((item) => (locale === "he" ? item.holiday.nameHe : item.holiday.nameEn))
    .join(" + ");

  const paymentLink = buildPaymentLink({
    billId: bill.referenceCode,
    amountAgorot: totalAgorot,
    clientName: bill.fullName,
    phone: bill.phone,
    email: bill.email,
    groupe,
    language: locale,
  });

  return { ok: true, billId: bill.referenceCode, totalAgorot, paymentLink };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildPaymentLink, buildRecurringPaymentLink, extractReferenceFromComment } from "@/lib/nedarim";
import { sendEmail, buildPaymentFollowUpEmail } from "@/lib/email";
import { parseNedarimFailureEmail, looksLikeNedarimFailureEmail } from "@/lib/nedarim-failure-email";
import { generateBillId } from "@/lib/billid";
import type { PaymentFollowUp } from "@/lib/generated/prisma/client";

const SHUL_NAME_EN = "Kehillas Tiferes Yisroel";
const SHUL_NAME_HE = "קהילת תפארת ישראל";

type FollowUpContext = {
  fullName: string;
  email: string | null;
  amountAgorot: number;
  description: string;
  descriptionHe: string;
  paymentLink: string | null;
  isPaid: boolean;
};

async function resolveFollowUpContext(followUp: PaymentFollowUp): Promise<FollowUpContext | null> {
  if (followUp.billId) {
    const bill = await prisma.bill.findUnique({
      where: { id: followUp.billId },
      include: { lineItems: { where: { deletedAt: null }, include: { holiday: true } } },
    });
    if (!bill) return null;
    const groupe = bill.lineItems.map((li) => li.holiday.nameEn).join(" + ") || "Holiday Seats";
    const groupeHe = bill.lineItems.map((li) => li.holiday.nameHe).join(" + ") || "מקומות ישיבה";
    return {
      fullName: bill.fullName,
      email: bill.email,
      amountAgorot: bill.totalAgorot,
      description: `holiday seats (${groupe})`,
      descriptionHe: `מקומות ישיבה (${groupeHe})`,
      paymentLink: buildPaymentLink({
        billId: bill.referenceCode,
        amountAgorot: bill.totalAgorot,
        clientName: bill.fullName,
        phone: bill.phone,
        email: bill.email,
        groupe,
      }),
      isPaid: bill.status === "PAID",
    };
  }

  if (followUp.donationId) {
    const donation = await prisma.donation.findUnique({ where: { id: followUp.donationId } });
    if (!donation) return null;
    return {
      fullName: donation.fullName,
      email: donation.email,
      amountAgorot: donation.amountAgorot,
      description: "your donation",
      descriptionHe: "התרומה שלכם",
      paymentLink: buildPaymentLink({
        billId: donation.referenceCode,
        amountAgorot: donation.amountAgorot,
        clientName: donation.fullName,
        phone: donation.phone,
        email: donation.email,
        street: donation.address,
        city: donation.city,
        groupe: donation.purpose ? `Donation - ${donation.purpose}` : "Donation",
        referencePrefix: "DON",
        redirectParam: "donation",
      }),
      isPaid: donation.status === "PAID",
    };
  }

  if (followUp.membershipId) {
    const membership = await prisma.membership.findUnique({ where: { id: followUp.membershipId } });
    if (!membership) return null;
    return {
      fullName: membership.fullName,
      email: membership.email,
      amountAgorot: membership.monthlyAgorot,
      description: "your monthly membership",
      descriptionHe: "החברות החודשית שלכם",
      paymentLink: buildRecurringPaymentLink({
        membershipId: membership.referenceCode,
        monthlyAmountAgorot: membership.monthlyAgorot,
        clientName: membership.fullName,
        phone: membership.phone,
        email: membership.email,
        street: membership.address,
        city: membership.city,
        groupe: membership.tier === "FULL" ? "Full Membership" : "Associate Membership",
      }),
      isPaid: membership.status === "ACTIVE",
    };
  }

  if (followUp.paymentLinkId) {
    const link = await prisma.paymentLink.findUnique({ where: { id: followUp.paymentLinkId } });
    if (!link) return null;
    return {
      fullName: link.fullName || "there",
      email: link.email,
      amountAgorot: link.amountAgorot,
      description: link.label,
      descriptionHe: link.label,
      paymentLink: buildPaymentLink({
        billId: link.referenceCode,
        amountAgorot: link.amountAgorot,
        clientName: link.fullName || "Payment",
        phone: link.phone || "",
        email: link.email,
        groupe: link.label,
        referencePrefix: "LINK",
        redirectParam: "link",
      }),
      isPaid: link.status === "PAID",
    };
  }

  return null;
}

/**
 * A standalone follow-up (no FK - a decline on something our system never
 * created, e.g. a pre-existing standing order) gets a real PaymentLink
 * provisioned the first time we're about to email it, so it becomes a
 * properly tracked record going forward: if they pay via this link, our
 * webhook flips it to PAID and auto-resolves the follow-up exactly like
 * everything else, instead of staying an untracked loose end forever.
 */
async function ensureFollowUpIsTrackable(followUp: PaymentFollowUp): Promise<PaymentFollowUp> {
  if (followUp.billId || followUp.donationId || followUp.membershipId || followUp.paymentLinkId) {
    return followUp;
  }
  if (!followUp.externalAmountAgorot) return followUp;

  const link = await prisma.paymentLink.create({
    data: {
      referenceCode: generateBillId(),
      label: followUp.externalCategory || "Follow-up payment",
      fullName: followUp.externalFullName,
      phone: followUp.externalPhone,
      email: followUp.externalEmail,
      amountAgorot: followUp.externalAmountAgorot,
    },
  });

  return prisma.paymentFollowUp.update({
    where: { id: followUp.id },
    data: { paymentLinkId: link.id },
  });
}

export type SendFollowUpResult = { ok: true } | { ok: false; error: string };

async function sendOneFollowUpEmail(followUpId: string): Promise<SendFollowUpResult> {
  let followUp = await prisma.paymentFollowUp.findUnique({ where: { id: followUpId } });
  if (!followUp) return { ok: false, error: "Not found." };
  if (followUp.status === "RESOLVED" || followUp.status === "DISMISSED") {
    return { ok: false, error: "This follow-up is already closed." };
  }

  followUp = await ensureFollowUpIsTrackable(followUp);

  const context = await resolveFollowUpContext(followUp);
  if (!context) return { ok: false, error: "The underlying payment record no longer exists." };
  if (context.isPaid) {
    await prisma.paymentFollowUp.update({
      where: { id: followUp.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), notes: "Resolved automatically - already paid." },
    });
    return { ok: false, error: "This has already been paid - marked resolved instead." };
  }
  if (!context.email) return { ok: false, error: "No email address on file for this person." };

  const email = buildPaymentFollowUpEmail({
    fullName: context.fullName,
    amountAgorot: context.amountAgorot,
    description: context.description,
    descriptionHe: context.descriptionHe,
    paymentLink: context.paymentLink,
    shulNameEn: SHUL_NAME_EN,
    shulNameHe: SHUL_NAME_HE,
  });

  const result = await sendEmail({ to: context.email, ...email });
  if (!result.ok) return result;

  await prisma.paymentFollowUp.update({
    where: { id: followUp.id },
    data: {
      status: "EMAIL_SENT",
      emailsSentCount: { increment: 1 },
      lastEmailSentAt: new Date(),
    },
  });

  return { ok: true };
}

export async function sendFollowUpEmailAction(followUpId: string): Promise<SendFollowUpResult> {
  const result = await sendOneFollowUpEmail(followUpId);
  revalidatePath("/admin/payment-follow-ups");
  return result;
}

export type SendAllFollowUpsResult = { sent: number; failed: number; errors: string[] };

export async function sendAllFollowUpEmailsAction(): Promise<SendAllFollowUpsResult> {
  const openFollowUps = await prisma.paymentFollowUp.findMany({ where: { status: "OPEN" } });

  let sent = 0;
  const errors: string[] = [];
  for (const followUp of openFollowUps) {
    const result = await sendOneFollowUpEmail(followUp.id);
    if (result.ok) sent++;
    else errors.push(result.error);
  }

  revalidatePath("/admin/payment-follow-ups");
  return { sent, failed: errors.length, errors };
}

export async function resolveFollowUpAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await prisma.paymentFollowUp.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  revalidatePath("/admin/payment-follow-ups");
}

export async function dismissFollowUpAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await prisma.paymentFollowUp.update({ where: { id }, data: { status: "DISMISSED" } });
  revalidatePath("/admin/payment-follow-ups");
}

export type ImportFailureEmailResult =
  | {
      ok: true;
      matched: "bill" | "donation" | "membership" | "paymentLink" | "external";
      name: string;
      amountAgorot: number | null;
    }
  | { ok: false; error: string };

type EntityLink = { billId?: string; donationId?: string; membershipId?: string; paymentLinkId?: string };

/**
 * Parses a pasted NedarimPlus decline email and creates/updates a
 * PaymentFollowUp - matched to one of our own records if the email's
 * comment field carries our Avour reference, or by order number against a
 * known Membership's kevaId (NedarimPlus's recurring-charge decline emails
 * for an already-established standing order carry that same order number),
 * or left standalone with the email's own contact details if neither
 * matches anything we created.
 */
export async function importFailureEmailAction(rawText: string): Promise<ImportFailureEmailResult> {
  if (!looksLikeNedarimFailureEmail(rawText)) {
    return { ok: false, error: "That doesn't look like a NedarimPlus decline email - paste the full email text." };
  }

  const parsed = parseNedarimFailureEmail(rawText);

  let link: EntityLink | null = null;
  let matched: "bill" | "donation" | "membership" | "paymentLink" | "external" = "external";
  let name = parsed.clientName ?? "Unknown";

  const reference = parsed.comments ? extractReferenceFromComment(parsed.comments) : null;
  if (reference) {
    if (reference.kind === "BILL") {
      const bill = await prisma.bill.findUnique({ where: { referenceCode: reference.code } });
      if (bill) {
        link = { billId: bill.id };
        matched = "bill";
        name = bill.fullName;
      }
    } else if (reference.kind === "DON") {
      const donation = await prisma.donation.findUnique({ where: { referenceCode: reference.code } });
      if (donation) {
        link = { donationId: donation.id };
        matched = "donation";
        name = donation.fullName;
      }
    } else if (reference.kind === "MEM") {
      const membership = await prisma.membership.findUnique({ where: { referenceCode: reference.code } });
      if (membership) {
        link = { membershipId: membership.id };
        matched = "membership";
        name = membership.fullName;
      }
    } else if (reference.kind === "LINK") {
      const paymentLink = await prisma.paymentLink.findUnique({ where: { referenceCode: reference.code } });
      if (paymentLink) {
        link = { paymentLinkId: paymentLink.id };
        matched = "paymentLink";
        name = paymentLink.fullName || paymentLink.label;
      }
    }
  }

  if (!link && parsed.orderNumber) {
    const membership = await prisma.membership.findUnique({ where: { kevaId: parsed.orderNumber } });
    if (membership) {
      link = { membershipId: membership.id };
      matched = "membership";
      name = membership.fullName;
    }
  }

  const diagnostics = {
    reason: "FAILURE_EMAIL" as const,
    failureReason: parsed.failureReason,
    cardLast4: parsed.cardLast4,
    notes: `Imported from a NedarimPlus decline email${parsed.orderNumber ? ` (order ${parsed.orderNumber})` : ""}.`,
  };

  if (link) {
    const existing = await prisma.paymentFollowUp.findFirst({
      where: { ...link, status: { in: ["OPEN", "EMAIL_SENT"] } },
    });
    if (existing) {
      await prisma.paymentFollowUp.update({ where: { id: existing.id }, data: diagnostics });
    } else {
      await prisma.paymentFollowUp.create({ data: { ...link, ...diagnostics } });
    }
  } else {
    const existing = parsed.orderNumber
      ? await prisma.paymentFollowUp.findFirst({
          where: { externalKevaId: parsed.orderNumber, status: { in: ["OPEN", "EMAIL_SENT"] } },
        })
      : null;
    const standaloneData = {
      ...diagnostics,
      externalFullName: parsed.clientName,
      externalPhone: parsed.phone,
      externalEmail: parsed.email,
      externalAmountAgorot: parsed.amountAgorot,
      externalCategory: parsed.category,
      externalKevaId: parsed.orderNumber,
    };
    if (existing) {
      await prisma.paymentFollowUp.update({ where: { id: existing.id }, data: standaloneData });
    } else {
      await prisma.paymentFollowUp.create({ data: standaloneData });
    }
  }

  revalidatePath("/admin/payment-follow-ups");
  return { ok: true, matched, name, amountAgorot: parsed.amountAgorot };
}

export type FlagPayableKind = "bill" | "donation" | "membership" | "paymentLink";

/** Lets staff flag a payment as failed the moment they read a forwarded NedarimPlus decline email, without waiting for the stale-pending auto-detector. */
export async function flagForFollowUpAction(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as FlagPayableKind;
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) return;

  const linkField: Record<FlagPayableKind, { billId?: string; donationId?: string; membershipId?: string; paymentLinkId?: string }> = {
    bill: { billId: id },
    donation: { donationId: id },
    membership: { membershipId: id },
    paymentLink: { paymentLinkId: id },
  };
  const link = linkField[kind];
  if (!link) return;

  const existing = await prisma.paymentFollowUp.findFirst({
    where: { ...link, status: { in: ["OPEN", "EMAIL_SENT"] } },
  });
  if (existing) {
    await prisma.paymentFollowUp.update({ where: { id: existing.id }, data: { notes } });
  } else {
    await prisma.paymentFollowUp.create({
      data: { ...link, reason: "MANUAL", notes },
    });
  }

  revalidatePath("/admin/payment-follow-ups");
}

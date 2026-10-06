"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { diffFields, recordAuditLog } from "@/lib/audit-log";

export type PayableKind = "donation" | "membership" | "paymentLink";

async function revalidateAll() {
  revalidatePath("/admin/donations");
  revalidatePath("/admin/memberships");
  revalidatePath("/admin/payment-links");
  revalidatePath("/admin/payment-follow-ups");
  revalidatePath("/admin");
}

export async function markDonationPaidAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const donation = await prisma.donation.findUnique({ where: { id } });
  if (!donation) return;
  await prisma.$transaction([
    prisma.donation.update({ where: { id }, data: { status: "PAID" } }),
    prisma.transaction.create({
      data: { donationId: id, amountAgorot: donation.amountAgorot, source: "manual" },
    }),
  ]);
  await recordAuditLog({
    action: "mark_paid",
    recordType: "donation",
    recordId: id,
    changes: diffFields(donation, { status: "PAID" }),
  });
  await revalidateAll();
}

export async function cancelDonationAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const donation = await prisma.donation.findUnique({ where: { id } });
  if (!donation) return;
  await prisma.donation.update({ where: { id }, data: { status: "CANCELLED" } });
  await recordAuditLog({
    action: "cancel",
    recordType: "donation",
    recordId: id,
    changes: diffFields(donation, { status: "CANCELLED" }),
  });
  await revalidateAll();
}

export async function cancelMembershipAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const membership = await prisma.membership.findUnique({ where: { id } });
  if (!membership) return;
  await prisma.membership.update({ where: { id }, data: { status: "CANCELLED" } });
  await recordAuditLog({
    action: "cancel",
    recordType: "membership",
    recordId: id,
    changes: diffFields(membership, { status: "CANCELLED" }),
  });
  await revalidateAll();
}

export async function reactivateMembershipAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const membership = await prisma.membership.findUnique({ where: { id } });
  if (!membership) return;
  await prisma.membership.update({ where: { id }, data: { status: "ACTIVE" } });
  await recordAuditLog({
    action: "reactivate",
    recordType: "membership",
    recordId: id,
    changes: diffFields(membership, { status: "ACTIVE" }),
  });
  await revalidateAll();
}

export async function markPaymentLinkPaidAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const link = await prisma.paymentLink.findUnique({ where: { id } });
  if (!link) return;
  await prisma.$transaction([
    prisma.paymentLink.update({ where: { id }, data: { status: "PAID" } }),
    prisma.transaction.create({
      data: { paymentLinkId: id, amountAgorot: link.amountAgorot, source: "manual" },
    }),
  ]);
  await recordAuditLog({
    action: "mark_paid",
    recordType: "paymentLink",
    recordId: id,
    changes: diffFields(link, { status: "PAID" }),
  });
  await revalidateAll();
}

export type OverrideResult = { ok: true } | { ok: false; error: string };

export type OverrideDonationInput = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  amountShekels: number;
  purpose?: string;
  status: "PENDING" | "PAID" | "CANCELLED";
};

/** SUPERADMIN-only: directly overwrite a donation's recorded details - e.g. a staff-side correction after reconciling with the bank statement. */
export async function overrideDonationAction(input: OverrideDonationInput): Promise<OverrideResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const email = input.email.trim();
  if (!email) return { ok: false, error: "Email is required." };

  const before = await prisma.donation.findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: "Donation not found." };

  const after = {
    fullName: input.fullName.trim(),
    email,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    amountAgorot: Math.round(input.amountShekels * 100),
    purpose: input.purpose?.trim() || null,
    status: input.status,
  };

  await prisma.donation.update({ where: { id: input.id }, data: after });
  await recordAuditLog({ action: "override", recordType: "donation", recordId: input.id, changes: diffFields(before, after) });
  await revalidateAll();
  return { ok: true };
}

export type OverrideMembershipInput = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  monthlyShekels: number;
  status: "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
};

/** SUPERADMIN-only: directly overwrite a membership's recorded details. */
export async function overrideMembershipAction(input: OverrideMembershipInput): Promise<OverrideResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const email = input.email.trim();
  if (!email) return { ok: false, error: "Email is required." };

  const before = await prisma.membership.findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: "Membership not found." };

  const after = {
    fullName: input.fullName.trim(),
    email,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    monthlyAgorot: Math.round(input.monthlyShekels * 100),
    status: input.status,
  };

  await prisma.membership.update({ where: { id: input.id }, data: after });
  await recordAuditLog({ action: "override", recordType: "membership", recordId: input.id, changes: diffFields(before, after) });
  await revalidateAll();
  return { ok: true };
}

export type OverridePaymentLinkInput = {
  id: string;
  label: string;
  fullName?: string;
  phone?: string;
  email?: string;
  amountShekels: number;
  status: "PENDING" | "PAID" | "CANCELLED";
};

/** SUPERADMIN-only: directly overwrite a payment link's recorded details. */
export async function overridePaymentLinkAction(input: OverridePaymentLinkInput): Promise<OverrideResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const before = await prisma.paymentLink.findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: "Payment link not found." };

  const after = {
    label: input.label.trim(),
    fullName: input.fullName?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    amountAgorot: Math.round(input.amountShekels * 100),
    status: input.status,
  };

  await prisma.paymentLink.update({ where: { id: input.id }, data: after });
  await recordAuditLog({ action: "override", recordType: "paymentLink", recordId: input.id, changes: diffFields(before, after) });
  await revalidateAll();
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeTotalAgorot } from "@/lib/holidays";
import { diffFields, recordAuditLog } from "@/lib/audit-log";

async function revalidateForBill(billId: string) {
  const lineItems = await prisma.signup.findMany({
    where: { billId },
    select: { holidayId: true },
  });
  for (const item of lineItems) {
    revalidatePath(`/admin/holidays/${item.holidayId}/signups`);
    revalidatePath(`/admin/holidays/${item.holidayId}`);
  }
  revalidatePath("/admin");
}

export async function markSignupPaidAction(formData: FormData) {
  const billId = String(formData.get("billId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) return;

  await prisma.$transaction([
    prisma.bill.update({ where: { id: billId }, data: { status: "PAID" } }),
    prisma.transaction.create({
      data: {
        billId,
        confirmation: confirmation || null,
        amountAgorot: bill.totalAgorot,
        source: "manual",
      },
    }),
  ]);
  await recordAuditLog({ action: "mark_paid", recordType: "bill", recordId: billId, changes: diffFields(bill, { status: "PAID" }) });

  await revalidateForBill(billId);
}

export async function cancelSignupAction(formData: FormData) {
  const billId = String(formData.get("billId") ?? "");
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) return;
  await prisma.bill.update({ where: { id: billId }, data: { status: "CANCELLED" } });
  await recordAuditLog({ action: "cancel", recordType: "bill", recordId: billId, changes: diffFields(bill, { status: "CANCELLED" }) });
  await revalidateForBill(billId);
}

export async function reopenSignupAction(formData: FormData) {
  const billId = String(formData.get("billId") ?? "");
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) return;
  await prisma.bill.update({ where: { id: billId }, data: { status: "PENDING" } });
  await recordAuditLog({ action: "reopen", recordType: "bill", recordId: billId, changes: diffFields(bill, { status: "PENDING" }) });
  await revalidateForBill(billId);
}

export type UpdateSignupInput = {
  signupId: string;
  fullName: string;
  phone: string;
  email?: string;
  isMember: boolean;
  notes?: string;
  menSeats: number;
  womenSeats: number;
};

export type UpdateSignupResult = { ok: true } | { ok: false; error: string };

/**
 * Corrects an existing submission after the fact (typo in a name, wrong seat
 * count, etc.) - never deletes or recreates anything, only updates the Bill and
 * its Signup line item(s) in place via one atomic transaction. Membership status
 * is shared across a whole Bill (all of a family's holidays in one payment), so
 * changing it here recomputes every one of that bill's line items, not just the
 * one being edited, to keep Bill.totalAgorot consistent with its line items.
 */
export async function updateSignup(input: UpdateSignupInput): Promise<UpdateSignupResult> {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  if (!fullName || !phone) return { ok: false, error: "Name and phone are required." };

  const menSeats = Math.max(0, Math.floor(Number(input.menSeats)) || 0);
  const womenSeats = Math.max(0, Math.floor(Number(input.womenSeats)) || 0);
  if (menSeats + womenSeats < 1) return { ok: false, error: "At least one seat is required." };

  const signup = await prisma.signup.findUnique({
    where: { id: input.signupId },
    include: {
      holiday: true,
      bill: { include: { lineItems: { where: { deletedAt: null }, include: { holiday: true } } } },
    },
  });
  if (!signup || signup.deletedAt) return { ok: false, error: "This signup could not be found." };

  const bill = signup.bill;
  const otherLineItems = bill.lineItems.filter((li) => li.id !== signup.id);

  const updatedTotal = computeTotalAgorot(signup.holiday, input.isMember, menSeats, womenSeats);
  const otherTotals = otherLineItems.map((li) => ({
    id: li.id,
    totalAgorot: computeTotalAgorot(li.holiday, input.isMember, li.menSeats, li.womenSeats),
  }));
  const newBillTotal = updatedTotal + otherTotals.reduce((sum, li) => sum + li.totalAgorot, 0);

  const billChanges = {
    fullName,
    phone,
    email: input.email?.trim() || null,
    isMember: input.isMember,
    notes: input.notes?.trim() || null,
    totalAgorot: newBillTotal,
  };

  await prisma.$transaction([
    prisma.bill.update({ where: { id: bill.id }, data: billChanges }),
    prisma.signup.update({
      where: { id: signup.id },
      data: { menSeats, womenSeats, totalAgorot: updatedTotal },
    }),
    ...otherTotals.map((li) =>
      prisma.signup.update({ where: { id: li.id }, data: { totalAgorot: li.totalAgorot } })
    ),
  ]);
  await recordAuditLog({
    action: "update",
    recordType: "bill",
    recordId: bill.id,
    changes: {
      ...diffFields(bill, billChanges),
      ...diffFields({ menSeats: signup.menSeats, womenSeats: signup.womenSeats }, { menSeats, womenSeats }),
    },
  });

  for (const li of bill.lineItems) {
    revalidatePath(`/admin/holidays/${li.holidayId}/signups`);
    revalidatePath(`/admin/holidays/${li.holidayId}`);
  }
  revalidatePath("/admin");

  return { ok: true };
}

/**
 * Soft-deletes a single line item (one holiday within a bill), not the whole bill -
 * a family's other holiday selections in the same payment are untouched. Deleted
 * rows are excluded from all admin views, dashboard totals, and CSV exports, but
 * stay in the database (never hard-deleted).
 */
export async function deleteSignupLineItemAction(formData: FormData) {
  const signupId = String(formData.get("signupId") ?? "");
  const signup = await prisma.signup.update({
    where: { id: signupId },
    data: { deletedAt: new Date() },
  });
  await recordAuditLog({
    action: "delete",
    recordType: "signup",
    recordId: signupId,
    changes: { deletedAt: { before: null, after: signup.deletedAt } },
  });
  revalidatePath(`/admin/holidays/${signup.holidayId}/signups`);
  revalidatePath(`/admin/holidays/${signup.holidayId}`);
  revalidatePath("/admin");
}

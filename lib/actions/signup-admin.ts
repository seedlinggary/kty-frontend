"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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

  await revalidateForBill(billId);
}

export async function cancelSignupAction(formData: FormData) {
  const billId = String(formData.get("billId") ?? "");
  await prisma.bill.update({ where: { id: billId }, data: { status: "CANCELLED" } });
  await revalidateForBill(billId);
}

export async function reopenSignupAction(formData: FormData) {
  const billId = String(formData.get("billId") ?? "");
  await prisma.bill.update({ where: { id: billId }, data: { status: "PENDING" } });
  await revalidateForBill(billId);
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
  revalidatePath(`/admin/holidays/${signup.holidayId}/signups`);
  revalidatePath(`/admin/holidays/${signup.holidayId}`);
  revalidatePath("/admin");
}

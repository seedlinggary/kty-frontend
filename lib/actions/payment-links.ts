"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { buildPaymentLink } from "@/lib/nedarim";
import { generateBillId } from "@/lib/billid";
import { shekelsToAgorot } from "@/lib/money";
import { requireSuperAdmin } from "@/lib/auth-helpers";

export type CreatePaymentLinkInput = {
  label: string;
  fullName?: string;
  phone?: string;
  email?: string;
  amountShekels: number;
};

export type CreatePaymentLinkResult =
  | { ok: true; paymentLinkId: string; paymentLink: string | null }
  | { ok: false; error: string };

/** Superuser-only: a fixed, predetermined amount someone can just pay. */
export async function createPaymentLink(
  input: CreatePaymentLinkInput
): Promise<CreatePaymentLinkResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const label = input.label?.trim();
  if (!label) return { ok: false, error: "A label is required so staff know what this is for." };

  const amountAgorot = shekelsToAgorot(Number(input.amountShekels) || 0);
  if (amountAgorot < 1) return { ok: false, error: "Enter a valid amount." };

  const link = await prisma.paymentLink.create({
    data: {
      referenceCode: generateBillId(),
      label,
      fullName: input.fullName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      amountAgorot,
    },
  });

  const paymentLink = buildPaymentLink({
    billId: link.referenceCode,
    amountAgorot,
    clientName: link.fullName || "Payment",
    phone: link.phone || "",
    email: link.email,
    groupe: label,
    referencePrefix: "LINK",
    redirectParam: "link",
  });

  revalidatePath("/admin/payment-links");
  return { ok: true, paymentLinkId: link.id, paymentLink };
}

export async function cancelPaymentLinkAction(formData: FormData) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return;
  const id = String(formData.get("id") ?? "");
  await prisma.paymentLink.update({ where: { id }, data: { status: "CANCELLED" } });
  revalidatePath("/admin/payment-links");
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

async function revalidateForSignup(holidayId: string) {
  revalidatePath(`/admin/holidays/${holidayId}/signups`);
  revalidatePath(`/admin/holidays/${holidayId}`);
  revalidatePath("/admin");
}

export async function markSignupPaidAction(formData: FormData) {
  const signupId = String(formData.get("signupId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  const signup = await prisma.signup.findUnique({ where: { id: signupId } });
  if (!signup) return;

  await prisma.$transaction([
    prisma.signup.update({ where: { id: signupId }, data: { status: "PAID" } }),
    prisma.transaction.create({
      data: {
        signupId,
        confirmation: confirmation || null,
        amountAgorot: signup.totalAgorot,
        source: "manual",
      },
    }),
  ]);

  await revalidateForSignup(signup.holidayId);
}

export async function cancelSignupAction(formData: FormData) {
  const signupId = String(formData.get("signupId") ?? "");
  const signup = await prisma.signup.update({ where: { id: signupId }, data: { status: "CANCELLED" } });
  await revalidateForSignup(signup.holidayId);
}

export async function reopenSignupAction(formData: FormData) {
  const signupId = String(formData.get("signupId") ?? "");
  const signup = await prisma.signup.update({ where: { id: signupId }, data: { status: "PENDING" } });
  await revalidateForSignup(signup.holidayId);
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAnswerEmpty } from "@/lib/forms";

export type SubmitFormResponseInput = {
  formId: string;
  answers: Record<string, unknown>;
};

export type SubmitFormResponseResult = { ok: true } | { ok: false; error: string };

export async function submitFormResponse(
  input: SubmitFormResponseInput
): Promise<SubmitFormResponseResult> {
  const form = await prisma.form.findUnique({
    where: { id: input.formId },
    include: { fields: { where: { archivedAt: null } } },
  });
  if (!form || !form.isOpen) return { ok: false, error: "This form isn't available." };

  for (const field of form.fields) {
    if (field.required && isAnswerEmpty(input.answers[field.id])) {
      return { ok: false, error: `"${field.label}" is required.` };
    }
  }

  await prisma.formResponse.create({
    data: { formId: form.id, answers: input.answers as object },
  });

  return { ok: true };
}

export type UpdateFormResponseResult = { ok: true } | { ok: false; error: string };

export async function updateFormResponse(
  responseId: string,
  answers: Record<string, unknown>
): Promise<UpdateFormResponseResult> {
  const response = await prisma.formResponse.findUnique({
    where: { id: responseId },
    include: { form: { include: { fields: { where: { archivedAt: null } } } } },
  });
  if (!response) return { ok: false, error: "Response not found." };

  for (const field of response.form.fields) {
    if (field.required && isAnswerEmpty(answers[field.id])) {
      return { ok: false, error: `"${field.label}" is required.` };
    }
  }

  await prisma.formResponse.update({
    where: { id: responseId },
    data: { answers: answers as object },
  });

  revalidatePath(`/admin/forms/${response.formId}/responses`);
  return { ok: true };
}

export async function deleteFormResponseAction(formData: FormData) {
  const responseId = String(formData.get("responseId") ?? "");
  const response = await prisma.formResponse.update({
    where: { id: responseId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/admin/forms/${response.formId}/responses`);
  revalidatePath(`/admin/forms/${response.formId}`);
}

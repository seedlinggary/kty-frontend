"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getFieldLabel, isAnswerEmpty, isFieldVisible } from "@/lib/forms";
import { diffFields, recordAuditLog } from "@/lib/audit-log";

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
    if (!isFieldVisible(field, input.answers)) continue;
    if (field.required && isAnswerEmpty(input.answers[field.id])) {
      return { ok: false, error: `"${getFieldLabel(field, input.answers)}" is required.` };
    }
  }

  // Drop answers for fields that were hidden by the submitted answers (defense in
  // depth - the client already filters these, but never trust it for storage).
  const visibleIds = new Set(
    form.fields.filter((field) => isFieldVisible(field, input.answers)).map((f) => f.id)
  );
  const answers = Object.fromEntries(
    Object.entries(input.answers).filter(([id]) => visibleIds.has(id))
  );

  await prisma.formResponse.create({
    data: { formId: form.id, answers: answers as object },
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
    if (!isFieldVisible(field, answers)) continue;
    if (field.required && isAnswerEmpty(answers[field.id])) {
      return { ok: false, error: `"${getFieldLabel(field, answers)}" is required.` };
    }
  }

  const visibleIds = new Set(
    response.form.fields.filter((field) => isFieldVisible(field, answers)).map((f) => f.id)
  );
  const savedAnswers = Object.fromEntries(
    Object.entries(answers).filter(([id]) => visibleIds.has(id))
  );

  await prisma.formResponse.update({
    where: { id: responseId },
    data: { answers: savedAnswers as object },
  });
  // JSON blobs compare by reference under diffFields' !== check, so stringify
  // first - otherwise every save would log as "changed" even when nothing
  // actually was.
  if (JSON.stringify(response.answers) !== JSON.stringify(savedAnswers)) {
    await recordAuditLog({
      action: "edit",
      recordType: "formResponse",
      recordId: responseId,
      changes: diffFields({ answers: response.answers }, { answers: savedAnswers }),
    });
  }

  revalidatePath(`/admin/forms/${response.formId}/responses`);
  return { ok: true };
}

export async function deleteFormResponseAction(formData: FormData) {
  const responseId = String(formData.get("responseId") ?? "");
  const response = await prisma.formResponse.update({
    where: { id: responseId },
    data: { deletedAt: new Date() },
  });
  await recordAuditLog({
    action: "soft_delete",
    recordType: "formResponse",
    recordId: responseId,
    changes: diffFields({ deletedAt: null }, { deletedAt: response.deletedAt }),
  });
  revalidatePath(`/admin/forms/${response.formId}/responses`);
  revalidatePath(`/admin/forms/${response.formId}`);
}

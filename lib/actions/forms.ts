"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isChoiceType } from "@/lib/forms";
import type { FormFieldType } from "@/lib/generated/prisma/client";

export type FieldDraft = {
  id?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: string[];
  helpText: string;
};

export type SaveFormInput = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  thankYouMessage: string;
  isOpen: boolean;
  fields: FieldDraft[];
};

export type SaveFormResult = { ok: true; formId: string } | { ok: false; error: string };

export async function saveForm(input: SaveFormInput): Promise<SaveFormResult> {
  const title = input.title.trim();
  const slug = slugify(input.slug || title);

  if (!title) return { ok: false, error: "A title is required." };
  if (!slug) return { ok: false, error: "A URL slug is required." };
  if (input.fields.length === 0) return { ok: false, error: "Add at least one field." };
  for (const field of input.fields) {
    if (!field.label.trim()) return { ok: false, error: "Every field needs a label." };
    if (isChoiceType(field.type) && field.options.filter((o) => o.trim()).length === 0) {
      return { ok: false, error: `"${field.label}" needs at least one option.` };
    }
  }

  const existingWithSlug = await prisma.form.findUnique({ where: { slug } });
  if (existingWithSlug && existingWithSlug.id !== input.id) {
    return { ok: false, error: `The slug "${slug}" is already used by another form.` };
  }

  const formId = await prisma.$transaction(async (tx) => {
    const formData = {
      title,
      slug,
      description: input.description.trim() || null,
      thankYouMessage: input.thankYouMessage.trim() || null,
      isOpen: input.isOpen,
    };

    const formRecord = input.id
      ? await tx.form.update({ where: { id: input.id }, data: formData })
      : await tx.form.create({ data: formData });

    const existingFields = input.id
      ? await tx.formField.findMany({ where: { formId: formRecord.id } })
      : [];
    const keptIds = new Set(input.fields.filter((f) => f.id).map((f) => f.id));

    // Archive fields that existed before but were removed from this save - never
    // hard-deleted, so any response that already answered them stays resolvable.
    for (const existing of existingFields) {
      if (!keptIds.has(existing.id) && !existing.archivedAt) {
        await tx.formField.update({ where: { id: existing.id }, data: { archivedAt: new Date() } });
      }
    }

    for (let i = 0; i < input.fields.length; i++) {
      const field = input.fields[i];
      const data = {
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: isChoiceType(field.type) ? field.options.map((o) => o.trim()).filter(Boolean) : undefined,
        helpText: field.helpText.trim() || null,
        order: i,
        archivedAt: null,
      };

      if (field.id) {
        await tx.formField.update({ where: { id: field.id }, data });
      } else {
        await tx.formField.create({ data: { ...data, formId: formRecord.id } });
      }
    }

    return formRecord.id;
  });

  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${formId}`);
  revalidatePath(`/forms/${slug}`);

  return { ok: true, formId };
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isChoiceType } from "@/lib/forms";
import type { FieldConditionMode, FormFieldType } from "@/lib/generated/prisma/client";

export type FieldDraft = {
  /** Stable per-row identifier from the builder, used to resolve conditionKey
   *  references to real ids within the same save (works even for two brand-new
   *  fields created together, e.g. a question and the one it depends on). */
  key: string;
  id?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: string[];
  helpText: string;
  /** key of the field this one's visibility/label depends on, if any. */
  conditionKey?: string | null;
  conditionValue?: string | null;
  conditionMode?: FieldConditionMode | null;
  altLabel?: string | null;
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

    // The builder only ever lets a field depend on an earlier one (see the
    // "Depends on" dropdown in FormBuilder), so a single forward pass is
    // enough: by the time we reach a dependent field, keyToId already has
    // its dependency's real id (new or existing) - no second pass of extra
    // per-field queries needed, which matters since production runs through
    // Supabase's transaction-mode pooler and doubling the query count inside
    // one interactive transaction there caused real save failures.
    const keyToId = new Map<string, string>();

    for (let i = 0; i < input.fields.length; i++) {
      const field = input.fields[i];
      const conditionFieldId = field.conditionKey ? keyToId.get(field.conditionKey) ?? null : null;
      const data = {
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: isChoiceType(field.type) ? field.options.map((o) => o.trim()).filter(Boolean) : undefined,
        helpText: field.helpText.trim() || null,
        order: i,
        archivedAt: null,
        conditionFieldId,
        conditionValue: conditionFieldId ? field.conditionValue?.trim() || null : null,
        conditionMode: conditionFieldId ? field.conditionMode ?? null : null,
        altLabel: conditionFieldId ? field.altLabel?.trim() || null : null,
      };

      if (field.id) {
        await tx.formField.update({ where: { id: field.id }, data });
        keyToId.set(field.key, field.id);
      } else {
        const created = await tx.formField.create({ data: { ...data, formId: formRecord.id } });
        keyToId.set(field.key, created.id);
      }
    }

    return formRecord.id;
  });

  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${formId}`);
  revalidatePath(`/forms/${slug}`);

  return { ok: true, formId };
}

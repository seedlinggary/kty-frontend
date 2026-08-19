"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { shekelsToAgorot } from "@/lib/money";

export type FormState = { error?: string } | undefined;

function parseHolidayForm(formData: FormData) {
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const nameHe = String(formData.get("nameHe") ?? "").trim();
  const descriptionEn = String(formData.get("descriptionEn") ?? "").trim();
  const descriptionHe = String(formData.get("descriptionHe") ?? "").trim();
  const memberPrice = Number(formData.get("memberPrice"));
  const nonMemberPrice = Number(formData.get("nonMemberPrice"));
  const isOpen = formData.get("isOpen") === "on";
  const slug = slugify(String(formData.get("slug") ?? "") || nameEn);

  return { nameEn, nameHe, descriptionEn, descriptionHe, memberPrice, nonMemberPrice, isOpen, slug };
}

function validateHolidayForm(fields: ReturnType<typeof parseHolidayForm>): string | null {
  if (!fields.nameEn || !fields.nameHe) return "English and Hebrew names are required.";
  if (!fields.slug) return "A URL slug is required.";
  if (
    !Number.isFinite(fields.memberPrice) ||
    fields.memberPrice < 0 ||
    !Number.isFinite(fields.nonMemberPrice) ||
    fields.nonMemberPrice < 0
  ) {
    return "Prices must be valid non-negative numbers.";
  }
  return null;
}

export async function createHoliday(_prev: FormState, formData: FormData): Promise<FormState> {
  const fields = parseHolidayForm(formData);
  const validationError = validateHolidayForm(fields);
  if (validationError) return { error: validationError };

  const existing = await prisma.holiday.findUnique({ where: { slug: fields.slug } });
  if (existing) return { error: `The slug "${fields.slug}" is already used by another holiday.` };

  const holiday = await prisma.holiday.create({
    data: {
      slug: fields.slug,
      nameEn: fields.nameEn,
      nameHe: fields.nameHe,
      descriptionEn: fields.descriptionEn || null,
      descriptionHe: fields.descriptionHe || null,
      memberPriceAgorot: shekelsToAgorot(fields.memberPrice),
      nonMemberPriceAgorot: shekelsToAgorot(fields.nonMemberPrice),
      isOpen: fields.isOpen,
    },
  });

  redirect(`/admin/holidays/${holiday.id}`);
}

export async function updateHoliday(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = parseHolidayForm(formData);
  const validationError = validateHolidayForm(fields);
  if (validationError) return { error: validationError };

  const existing = await prisma.holiday.findUnique({ where: { slug: fields.slug } });
  if (existing && existing.id !== id) {
    return { error: `The slug "${fields.slug}" is already used by another holiday.` };
  }

  await prisma.holiday.update({
    where: { id },
    data: {
      slug: fields.slug,
      nameEn: fields.nameEn,
      nameHe: fields.nameHe,
      descriptionEn: fields.descriptionEn || null,
      descriptionHe: fields.descriptionHe || null,
      memberPriceAgorot: shekelsToAgorot(fields.memberPrice),
      nonMemberPriceAgorot: shekelsToAgorot(fields.nonMemberPrice),
      isOpen: fields.isOpen,
    },
  });

  revalidatePath(`/admin/holidays/${id}`);
  revalidatePath("/admin");
  redirect(`/admin/holidays/${id}`);
}

export async function toggleHolidayOpen(id: string, isOpen: boolean) {
  await prisma.holiday.update({ where: { id }, data: { isOpen } });
  revalidatePath(`/admin/holidays/${id}`);
  revalidatePath("/admin/holidays");
  revalidatePath("/admin");
}

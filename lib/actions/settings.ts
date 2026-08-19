"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type SettingsFormState = { error?: string; success?: boolean } | undefined;

export async function updateSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const data = {
    aboutEn: String(formData.get("aboutEn") ?? "").trim(),
    aboutHe: String(formData.get("aboutHe") ?? "").trim(),
    contactPhone: String(formData.get("contactPhone") ?? "").trim(),
    contactEmail: String(formData.get("contactEmail") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    serviceTimesEn: String(formData.get("serviceTimesEn") ?? "").trim() || null,
    serviceTimesHe: String(formData.get("serviceTimesHe") ?? "").trim() || null,
    heroTaglineEn: String(formData.get("heroTaglineEn") ?? "").trim(),
    heroTaglineHe: String(formData.get("heroTaglineHe") ?? "").trim(),
  };

  if (!data.aboutEn || !data.aboutHe || !data.address) {
    return { error: "About text (both languages) and address are required." };
  }

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { success: true };
}

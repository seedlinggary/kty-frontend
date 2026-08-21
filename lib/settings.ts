import { prisma } from "@/lib/prisma";

export type SiteSettingsData = {
  aboutEn: string;
  aboutHe: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  serviceTimesEn: string | null;
  serviceTimesHe: string | null;
  heroTaglineEn: string;
  heroTaglineHe: string;
};

const FALLBACK_SETTINGS: SiteSettingsData = {
  aboutEn:
    "Kehillas Tiferes Yisroel is a small, tight-knit Anglo Charedi community in Ramat Beit Shemesh Hey.",
  aboutHe: "קהילת תפארת ישראל היא קהילה חרדית-אנגלוסקסית קטנה ומלוכדת ברמת בית שמש ה'.",
  contactPhone: "",
  contactEmail: "",
  address: "Across from Yonatan, Ramat Beit Shemesh Hey",
  serviceTimesEn: null,
  serviceTimesHe: null,
  heroTaglineEn: "A warm home for tefillah and learning in Ramat Beit Shemesh Hey.",
  heroTaglineHe: "בית חם לתפילה ולימוד ברמת בית שמש ה'.",
};

export async function getSiteSettings(): Promise<SiteSettingsData> {
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    return settings ?? FALLBACK_SETTINGS;
  } catch {
    return FALLBACK_SETTINGS;
  }
}

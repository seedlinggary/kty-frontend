import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { SeatSignupForm } from "@/components/site/seat-signup-form";
import { getHolidayBySlug, getOpenHolidays } from "@/lib/holidays";

// Must always reflect the latest admin edits (price, open/closed, description) immediately.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const holiday = await getHolidayBySlug(slug);
  if (!holiday) return {};
  return { title: locale === "he" ? holiday.nameHe : holiday.nameEn };
}

export default async function SeatSignupPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  const highlighted = await getHolidayBySlug(slug);
  if (!highlighted || !highlighted.isOpen) notFound();

  const t = await getTranslations("seats");
  // Show the full combined form (all open holidays) with this one highlighted, rather
  // than a separate single-holiday flow - keeps one consistent checkout experience.
  const holidays = await getOpenHolidays();

  return (
    <Container className="py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t("eyebrow")}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-ink">{t("formHeading")}</h1>

      <div className="mt-10 max-w-2xl">
        <SeatSignupForm
          holidays={holidays.map((h) => ({
            slug: h.slug,
            nameEn: h.nameEn,
            nameHe: h.nameHe,
            descriptionEn: h.descriptionEn,
            descriptionHe: h.descriptionHe,
            memberPriceAgorot: h.memberPriceAgorot,
            nonMemberPriceAgorot: h.nonMemberPriceAgorot,
          }))}
          highlightSlug={highlighted.slug}
          locale={isHe ? "he" : "en"}
        />
      </div>
    </Container>
  );
}

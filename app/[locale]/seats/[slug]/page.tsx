import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { SeatSignupForm } from "@/components/site/seat-signup-form";
import { getHolidayBySlug } from "@/lib/holidays";

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

  const holiday = await getHolidayBySlug(slug);
  if (!holiday || !holiday.isOpen) notFound();

  const t = await getTranslations("seats");
  const holidayName = isHe ? holiday.nameHe : holiday.nameEn;

  return (
    <Container className="py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-gold">{t("eyebrow")}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-navy">
        {t("formHeading", { holiday: holidayName })}
      </h1>
      {(isHe ? holiday.descriptionHe : holiday.descriptionEn) && (
        <p className="mt-3 max-w-2xl text-ink/70">
          {isHe ? holiday.descriptionHe : holiday.descriptionEn}
        </p>
      )}

      <div className="mt-10 max-w-2xl">
        <SeatSignupForm
          holidaySlug={holiday.slug}
          holidayName={holidayName}
          memberPriceAgorot={holiday.memberPriceAgorot}
          nonMemberPriceAgorot={holiday.nonMemberPriceAgorot}
          locale={isHe ? "he" : "en"}
        />
      </div>
    </Container>
  );
}

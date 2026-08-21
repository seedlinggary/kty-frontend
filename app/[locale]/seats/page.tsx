import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { SeatSignupForm } from "@/components/site/seat-signup-form";
import { getOpenHolidays } from "@/lib/holidays";

// Must always reflect the latest admin-created holidays - never statically cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seats" });
  return { title: t("formHeading") };
}

export default async function SeatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  const t = await getTranslations("seats");
  const holidays = await getOpenHolidays();

  return (
    <Container className="py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t("eyebrow")}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-ink">{t("formHeading")}</h1>

      {holidays.length === 0 ? (
        <p className="mt-10 text-ink/60">{t("noOpenHolidays")}</p>
      ) : (
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
            locale={isHe ? "he" : "en"}
          />
        </div>
      )}
    </Container>
  );
}

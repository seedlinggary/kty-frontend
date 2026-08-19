import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { getOpenHolidays } from "@/lib/holidays";
import { agorotToShekels } from "@/lib/money";

// Must always reflect the latest admin-created holidays - never statically cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seats" });
  return { title: t("listHeading") };
}

export default async function SeatsListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("seats");
  const holidays = await getOpenHolidays();
  const isHe = locale === "he";

  return (
    <Container className="py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-gold">{t("eyebrow")}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-navy">{t("listHeading")}</h1>

      {holidays.length === 0 ? (
        <p className="mt-10 text-ink/60">{t("listEmpty")}</p>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {holidays.map((h) => (
            <li key={h.id} className="rounded-xl border border-line bg-white p-6 shadow-sm">
              <h2 className="font-serif text-xl font-semibold text-navy">
                {isHe ? h.nameHe : h.nameEn}
              </h2>
              {(isHe ? h.descriptionHe : h.descriptionEn) && (
                <p className="mt-2 text-sm text-ink/70">
                  {isHe ? h.descriptionHe : h.descriptionEn}
                </p>
              )}
              <div className="mt-4 space-y-1 text-sm text-ink/70">
                <p>{t("perSeatMember", { price: agorotToShekels(h.memberPriceAgorot) })}</p>
                <p>{t("perSeatNonMember", { price: agorotToShekels(h.nonMemberPriceAgorot) })}</p>
              </div>
              <div className="mt-5">
                <LinkButton href={`/seats/${h.slug}`}>{t("signUpCta")}</LinkButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

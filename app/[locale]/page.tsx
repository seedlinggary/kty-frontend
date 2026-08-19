import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { getOpenHolidays } from "@/lib/holidays";
import { getSiteSettings } from "@/lib/settings";

// Must always reflect the latest admin-created holidays and Site Settings edits
// immediately - never statically cached at build time.
export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");
  const tSeats = await getTranslations("seats");
  const [openHolidays, settings] = await Promise.all([getOpenHolidays(), getSiteSettings()]);
  const isHe = locale === "he";
  const about = isHe ? settings.aboutHe : settings.aboutEn;
  const serviceTimes = isHe ? settings.serviceTimesHe : settings.serviceTimesEn;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "PlaceOfWorship",
    name: "Kehilat Tiferet Yisrael",
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: "Ramat Beit Shemesh",
      addressCountry: "IL",
    },
    telephone: settings.contactPhone || undefined,
    email: settings.contactEmail || undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="bg-navy text-cream">
        <Container className="flex flex-col items-start gap-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold-light">
            {t("heroEyebrow")}
          </p>
          <h1 className="max-w-2xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="max-w-xl text-lg text-cream/85">
            {isHe ? settings.heroTaglineHe : settings.heroTaglineEn}
          </p>
          <LinkButton href="/about" variant="primary">
            {t("heroCta")}
          </LinkButton>
        </Container>
      </section>

      <section className="border-b border-line bg-gold/10">
        <Container className="py-10">
          {openHolidays.length > 0 ? (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-navy">
                  {t("openSaleHeading")}
                </h2>
                <p className="mt-1 text-ink/70">
                  {t("openSaleBody", {
                    holiday: isHe ? openHolidays[0].nameHe : openHolidays[0].nameEn,
                  })}
                </p>
              </div>
              <LinkButton href={`/seats/${openHolidays[0].slug}`} variant="primary">
                {t("openSaleCta")}
              </LinkButton>
            </div>
          ) : (
            <p className="text-center text-ink/60">{t("noOpenSale")}</p>
          )}
        </Container>
      </section>

      {openHolidays.length > 1 && (
        <section>
          <Container className="py-6">
            <ul className="grid gap-3 sm:grid-cols-2">
              {openHolidays.slice(1).map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-white px-4 py-3"
                >
                  <span className="font-medium text-navy">{isHe ? h.nameHe : h.nameEn}</span>
                  <LinkButton href={`/seats/${h.slug}`} variant="ghost">
                    {tSeats("signUpCta")}
                  </LinkButton>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <section className="py-16">
        <Container className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-navy">{t("aboutHeading")}</h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-ink/80">{about}</p>
            <div className="mt-6">
              <LinkButton href="/about" variant="ghost">
                {t("aboutCta")}
              </LinkButton>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-cream-alt p-8">
            <h3 className="font-serif text-xl font-semibold text-navy">{t("contactHeading")}</h3>
            <dl className="mt-4 space-y-2 text-ink/80">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                  {t("addressLabel")}
                </dt>
                <dd>{settings.address}</dd>
              </div>
              {settings.contactPhone && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                    {t("phoneLabel")}
                  </dt>
                  <dd>{settings.contactPhone}</dd>
                </div>
              )}
              {settings.contactEmail && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                    {t("emailLabel")}
                  </dt>
                  <dd>{settings.contactEmail}</dd>
                </div>
              )}
            </dl>
            {serviceTimes && (
              <div className="mt-6 border-t border-line pt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                  {t("serviceTimesHeading")}
                </h4>
                <p className="mt-2 whitespace-pre-line text-ink/80">{serviceTimes}</p>
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}

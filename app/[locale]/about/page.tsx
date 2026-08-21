import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { getSiteSettings } from "@/lib/settings";
import logoIcon from "@/public/logo-icon.png";

// Must always reflect the latest Site Settings edits immediately - never statically cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("heading") };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("about");
  const settings = await getSiteSettings();
  const isHe = locale === "he";
  const about = isHe ? settings.aboutHe : settings.aboutEn;

  return (
    <Container className="py-16">
      <Image src={logoIcon} alt="" className="mb-6 h-16 w-auto" />
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t("eyebrow")}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-ink">{t("heading")}</h1>

      <div className="mt-10 grid gap-10 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="font-serif text-2xl font-semibold text-ink">{t("storyHeading")}</h2>
          <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink/80">{about}</p>
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-line bg-pale p-6">
            <h3 className="font-serif text-lg font-semibold text-ink">{t("rabbiHeading")}</h3>
            <p className="mt-2 text-ink/80">{t("rabbiName")}</p>
          </div>

          <div className="rounded-xl border border-line bg-pale p-6">
            <h3 className="font-serif text-lg font-semibold text-ink">{t("addressHeading")}</h3>
            <p className="mt-2 text-ink/80">{settings.address}</p>
          </div>

          {(settings.contactPhone || settings.contactEmail) && (
            <div className="rounded-xl border border-line bg-pale p-6">
              <h3 className="font-serif text-lg font-semibold text-ink">{t("contactHeading")}</h3>
              {settings.contactPhone && <p className="mt-2 text-ink/80">{settings.contactPhone}</p>}
              {settings.contactEmail && <p className="text-ink/80">{settings.contactEmail}</p>}
            </div>
          )}
        </aside>
      </div>
    </Container>
  );
}

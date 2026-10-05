import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { MembershipForm } from "@/components/site/membership-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "membership" });
  return { title: t("heading") };
}

export default async function MembershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isHe = locale === "he";

  const t = await getTranslations("membership");

  return (
    <Container className="max-w-2xl py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">{t("eyebrow")}</p>
      <h1 className="mt-2 font-serif text-4xl font-bold text-ink">{t("heading")}</h1>
      <div className="mt-10">
        <MembershipForm locale={isHe ? "he" : "en"} />
      </div>
    </Container>
  );
}

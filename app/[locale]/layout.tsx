import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import "../globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["latin", "hebrew"],
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-heading",
  weight: ["500", "700"],
  subsets: ["latin", "hebrew"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${t("name")} | Ramat Beit Shemesh Hey`,
      template: `%s | ${t("shortName")}`,
    },
    description:
      locale === "he"
        ? "קהילת תפארת ישראל - קהילה חרדית-אמריקאית ברמת בית שמש ה'. מידע על בית הכנסת, זמני תפילות והרשמה למקומות לחגים."
        : "Kehilat Tiferet Yisrael - a Charedi shul in Ramat Beit Shemesh Hey. Davening times, community info, and holiday seat sign-up.",
    alternates: {
      languages: { en: "/", he: "/he" },
    },
    openGraph: {
      title: t("name"),
      siteName: t("name"),
      locale: locale === "he" ? "he_IL" : "en_US",
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${heebo.variable} ${frankRuhl.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

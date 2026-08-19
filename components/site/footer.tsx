import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { getSiteSettings } from "@/lib/settings";

export async function Footer() {
  const t = await getTranslations();
  const settings = await getSiteSettings();

  return (
    <footer className="mt-auto border-t border-line bg-cream-alt">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-serif text-lg font-semibold text-navy">{t("site.name")}</p>
          <p className="mt-2 text-sm text-ink/70">{settings.address}</p>
        </div>

        <div className="text-sm text-ink/70">
          <p className="font-medium text-navy">{t("home.contactHeading")}</p>
          {settings.contactPhone && <p className="mt-2">{settings.contactPhone}</p>}
          {settings.contactEmail && <p>{settings.contactEmail}</p>}
        </div>

        <nav className="flex gap-6 text-sm text-ink/70 md:justify-end">
          <Link href="/" className="hover:text-navy">
            {t("nav.home")}
          </Link>
          <Link href="/about" className="hover:text-navy">
            {t("nav.about")}
          </Link>
          <Link href="/seats" className="hover:text-navy">
            {t("nav.seats")}
          </Link>
        </nav>
      </div>
      <div className="flex flex-col items-center gap-1 border-t border-line px-4 py-4 text-center text-xs text-ink/50 sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} {t("site.name")}. {t("footer.rights")}
        </p>
        <NextLink href="/admin/login" className="text-ink/40 hover:text-navy hover:underline">
          Staff Login
        </NextLink>
      </div>
    </footer>
  );
}

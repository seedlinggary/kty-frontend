import Image from "next/image";
import { getTranslations } from "next-intl/server";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { getSiteSettings } from "@/lib/settings";
import logoIcon from "@/public/logo-icon.png";

export async function Footer() {
  const t = await getTranslations();
  const settings = await getSiteSettings();

  return (
    <footer className="mt-auto bg-ink text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <Image src={logoIcon} alt="" className="h-10 w-auto" />
            <p className="font-serif text-lg font-semibold text-white">{t("site.name")}</p>
          </div>
          <p className="mt-3 text-sm text-white/70">{settings.address}</p>
        </div>

        <div className="text-sm text-white/70">
          <p className="font-medium text-white">{t("home.contactHeading")}</p>
          {settings.contactPhone && <p className="mt-2">{settings.contactPhone}</p>}
          {settings.contactEmail && <p>{settings.contactEmail}</p>}
        </div>

        <nav className="flex gap-6 text-sm text-white/70 md:justify-end">
          <Link href="/" className="hover:text-white">
            {t("nav.home")}
          </Link>
          <Link href="/about" className="hover:text-white">
            {t("nav.about")}
          </Link>
          <Link href="/seats" className="hover:text-white">
            {t("nav.seats")}
          </Link>
        </nav>
      </div>
      <div className="flex flex-col items-center gap-1 border-t border-white/15 px-4 py-4 text-center text-xs text-white/50 sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} {t("site.name")}. {t("footer.rights")}
        </p>
        <NextLink href="/admin/login" className="text-white/40 hover:text-white hover:underline">
          Staff Login
        </NextLink>
      </div>
    </footer>
  );
}

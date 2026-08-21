"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const nextLocale = locale === "en" ? "he" : "en";

  return (
    <Link
      href={pathname}
      locale={nextLocale}
      className="text-sm font-medium text-ink hover:text-accent transition-colors"
    >
      {t("language")}
    </Link>
  );
}

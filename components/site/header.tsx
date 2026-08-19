"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/site/locale-switcher";

const links = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/seats", key: "seats" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const tSite = useTranslations("site");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-navy text-cream">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 font-serif text-xl font-semibold tracking-tight">
          <span className="text-gold-light">{tSite("shortName")}</span>
          <span className="hidden text-base font-normal text-cream/80 sm:inline">
            {tSite("name")}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-gold-light ${
                  active ? "text-gold-light" : "text-cream/90"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
          <LocaleSwitcher />
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-cream/20 md:hidden"
          aria-label="Menu"
          aria-expanded={open}
        >
          <span className="sr-only">Toggle menu</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-cream/10 px-4 pb-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 text-sm font-medium text-cream/90 hover:bg-navy-light"
            >
              {t(link.key)}
            </Link>
          ))}
          <div className="px-2 py-2">
            <LocaleSwitcher />
          </div>
        </nav>
      )}
    </header>
  );
}

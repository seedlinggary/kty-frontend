"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/site/locale-switcher";
import logoIcon from "@/public/logo-icon.png";

const links = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/seats", key: "seats" },
  { href: "/donate", key: "donate" },
  { href: "/membership", key: "membership" },
] as const;

export function Header() {
  const t = useTranslations("nav");
  const tSite = useTranslations("site");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image src={logoIcon} alt="" priority className="h-11 w-auto" />
          <span className="hidden font-serif text-lg font-semibold tracking-tight text-ink sm:inline">
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
                className={`border-b-2 pb-1 text-sm font-medium transition-colors hover:text-accent ${
                  active ? "border-accent text-accent" : "border-transparent text-ink"
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
          className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink md:hidden"
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
        <nav className="flex flex-col gap-1 border-t border-line px-4 pb-4 md:hidden">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-2 py-2 text-sm font-medium hover:bg-pale ${
                  active ? "text-accent" : "text-ink"
                }`}
              >
                {t(link.key)}
              </Link>
            );
          })}
          <div className="px-2 py-2">
            <LocaleSwitcher />
          </div>
        </nav>
      )}
    </header>
  );
}

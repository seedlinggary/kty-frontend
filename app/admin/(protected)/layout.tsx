import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/actions/auth";
import logoIcon from "@/public/logo-icon.png";

const navLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/holidays", label: "Holidays" },
  { href: "/admin/settings", label: "Site Settings" },
];

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white sm:flex">
        <div className="flex items-center gap-2 border-b border-line px-6 py-5">
          <Image src={logoIcon} alt="" className="h-9 w-auto" />
          <p className="font-serif text-lg font-semibold text-ink">KTY Admin</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-ink/70 hover:bg-pale hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-4">
          <p className="truncate text-xs text-ink/50">{session?.user?.email}</p>
          <form action={logoutAction} className="mt-2">
            <button type="submit" className="text-sm font-medium text-ink hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 sm:hidden">
          <div className="flex items-center gap-2">
            <Image src={logoIcon} alt="" className="h-8 w-auto" />
            <p className="font-serif text-lg font-semibold text-ink">KTY Admin</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-sm font-medium text-ink hover:underline">
              Sign out
            </button>
          </form>
        </header>
        <nav className="flex gap-4 overflow-x-auto border-b border-line bg-white px-4 py-2 sm:hidden">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap text-sm font-medium text-ink/70">
              {link.label}
            </Link>
          ))}
        </nav>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

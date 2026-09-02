import type { Metadata } from "next";
import Image from "next/image";
import "../globals.css";
import logoIcon from "@/public/logo-icon.png";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Form | KTY",
    template: "%s | Kehillas Tiferes Yisroel",
  },
  // Never indexed - these links are shared directly, never discovered publicly.
  robots: { index: false, follow: false },
};

export default function FormsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-pale font-sans text-ink">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
            <Image src={logoIcon} alt="" className="h-10 w-auto" />
            <span className="font-serif text-lg font-semibold text-ink">
              Kehillas Tiferes Yisroel
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

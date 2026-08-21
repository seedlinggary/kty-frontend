import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import logoIcon from "@/public/logo-icon.png";

// Must always check the live payment status, never a cached/stale one.
export const dynamic = "force-dynamic";

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ bill?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { bill } = await searchParams;

  const t = await getTranslations("thankYou");

  const foundBill = bill
    ? await prisma.bill.findUnique({ where: { referenceCode: bill } }).catch(() => null)
    : null;

  let message = t("notFound");
  if (foundBill) {
    message = foundBill.status === "PAID" ? t("paid") : t("pending");
  }

  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <Image src={logoIcon} alt="" className="mb-6 h-14 w-auto" />
      <h1 className="font-serif text-3xl font-bold text-ink">{t("heading")}</h1>
      <p className="mt-4 max-w-md text-ink/70">{message}</p>
      <div className="mt-8">
        <LinkButton href="/">{t("backHome")}</LinkButton>
      </div>
    </Container>
  );
}

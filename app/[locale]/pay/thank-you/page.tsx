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
  searchParams: Promise<{ bill?: string; donation?: string; membership?: string; link?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const t = await getTranslations("thankYou");

  let message = t("notFound");

  if (sp.bill) {
    const bill = await prisma.bill.findUnique({ where: { referenceCode: sp.bill } }).catch(() => null);
    if (bill) message = bill.status === "PAID" ? t("paid") : t("pending");
  } else if (sp.donation) {
    const donation = await prisma.donation.findUnique({ where: { referenceCode: sp.donation } }).catch(() => null);
    if (donation) message = donation.status === "PAID" ? t("paidDonation") : t("pendingDonation");
  } else if (sp.membership) {
    const membership = await prisma.membership.findUnique({ where: { referenceCode: sp.membership } }).catch(() => null);
    if (membership) message = membership.status === "ACTIVE" ? t("paidMembership") : t("pendingMembership");
  } else if (sp.link) {
    const link = await prisma.paymentLink.findUnique({ where: { referenceCode: sp.link } }).catch(() => null);
    if (link) message = link.status === "PAID" ? t("paidLink") : t("pendingLink");
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

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agorotToShekels } from "@/lib/money";
import { OverridePaymentLinkForm } from "@/components/admin/override-payment-link-form";
import { AuditHistory } from "@/components/admin/audit-history";

export const metadata: Metadata = { title: "Edit Payment Link" };

export default async function EditPaymentLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") redirect("/admin/payment-links");

  const { id } = await params;
  const link = await prisma.paymentLink.findUnique({ where: { id } });
  if (!link) notFound();

  const lastConfirmed = await prisma.transaction.findFirst({
    where: { paymentLinkId: id },
    orderBy: { receivedAt: "desc" },
  });
  const auditEntries = await prisma.adminAuditLog.findMany({
    where: { recordType: "paymentLink", recordId: id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Edit Payment Link — {link.label}</h1>
      <p className="mt-1 text-sm text-ink/60">LINK-{link.referenceCode}</p>
      <div className="mt-6">
        <OverridePaymentLinkForm
          paymentLinkId={link.id}
          initial={{
            label: link.label,
            fullName: link.fullName ?? "",
            phone: link.phone ?? "",
            email: link.email ?? "",
            amountShekels: agorotToShekels(link.amountAgorot),
            status: link.status,
          }}
          lastConfirmedShekels={lastConfirmed ? agorotToShekels(lastConfirmed.amountAgorot) : null}
        />
      </div>
      <AuditHistory entries={auditEntries} />
    </div>
  );
}

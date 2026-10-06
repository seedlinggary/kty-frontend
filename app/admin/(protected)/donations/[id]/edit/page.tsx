import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agorotToShekels } from "@/lib/money";
import { OverrideDonationForm } from "@/components/admin/override-donation-form";
import { AuditHistory } from "@/components/admin/audit-history";

export const metadata: Metadata = { title: "Edit Donation" };

export default async function EditDonationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") redirect("/admin/donations");

  const { id } = await params;
  const donation = await prisma.donation.findUnique({ where: { id } });
  if (!donation) notFound();

  const lastConfirmed = await prisma.transaction.findFirst({
    where: { donationId: id },
    orderBy: { receivedAt: "desc" },
  });
  const auditEntries = await prisma.adminAuditLog.findMany({
    where: { recordType: "donation", recordId: id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Edit Donation — {donation.fullName}</h1>
      <p className="mt-1 text-sm text-ink/60">DON-{donation.referenceCode}</p>
      <div className="mt-6">
        <OverrideDonationForm
          donationId={donation.id}
          initial={{
            fullName: donation.fullName,
            email: donation.email,
            phone: donation.phone ?? "",
            address: donation.address ?? "",
            city: donation.city ?? "",
            amountShekels: agorotToShekels(donation.amountAgorot),
            purpose: donation.purpose ?? "",
            status: donation.status,
          }}
          lastConfirmedShekels={lastConfirmed ? agorotToShekels(lastConfirmed.amountAgorot) : null}
        />
      </div>
      <AuditHistory entries={auditEntries} />
    </div>
  );
}

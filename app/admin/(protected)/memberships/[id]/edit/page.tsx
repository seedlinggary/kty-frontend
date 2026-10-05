import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { agorotToShekels } from "@/lib/money";
import { OverrideMembershipForm } from "@/components/admin/override-membership-form";

export const metadata: Metadata = { title: "Edit Membership" };

export default async function EditMembershipPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "SUPERADMIN") redirect("/admin/memberships");

  const { id } = await params;
  const membership = await prisma.membership.findUnique({ where: { id } });
  if (!membership) notFound();

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Edit Membership — {membership.fullName}</h1>
      <p className="mt-1 text-sm text-ink/60">MEM-{membership.referenceCode}</p>
      <div className="mt-6">
        <OverrideMembershipForm
          membershipId={membership.id}
          initial={{
            fullName: membership.fullName,
            email: membership.email,
            phone: membership.phone ?? "",
            address: membership.address ?? "",
            city: membership.city ?? "",
            monthlyShekels: agorotToShekels(membership.monthlyAgorot),
            status: membership.status,
          }}
        />
      </div>
    </div>
  );
}

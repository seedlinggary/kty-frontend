import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminSignupForm } from "@/components/admin/admin-signup-form";

export const metadata: Metadata = { title: "Create Bill" };

export default async function NewSignupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) notFound();

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-navy">
        Create Bill — {holiday.nameEn}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Use this to create a seat reservation and payment link on behalf of a family (e.g. over the
        phone or at the front desk).
      </p>
      <div className="mt-6">
        <AdminSignupForm
          holidaySlug={holiday.slug}
          memberPriceAgorot={holiday.memberPriceAgorot}
          nonMemberPriceAgorot={holiday.nonMemberPriceAgorot}
        />
      </div>
    </div>
  );
}

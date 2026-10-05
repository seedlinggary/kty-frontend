import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EditSignupForm } from "@/components/admin/edit-signup-form";

export const metadata: Metadata = { title: "Edit Signup" };

export default async function EditSignupPage({
  params,
}: {
  params: Promise<{ id: string; signupId: string }>;
}) {
  const { id, signupId } = await params;

  const signup = await prisma.signup.findUnique({
    where: { id: signupId },
    include: {
      holiday: true,
      bill: {
        include: {
          lineItems: { where: { deletedAt: null }, include: { holiday: true } },
        },
      },
    },
  });
  if (!signup || signup.deletedAt || signup.holidayId !== id) notFound();

  const bill = signup.bill;
  const otherLineItems = bill.lineItems
    .filter((li) => li.id !== signup.id)
    .map((li) => ({
      holidayNameEn: li.holiday.nameEn,
      menSeats: li.menSeats,
      womenSeats: li.womenSeats,
    }));

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">
        Edit Signup — {signup.holiday.nameEn}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        BILL-{bill.referenceCode} · Correct a mistake in this family&apos;s submission.
      </p>
      <div className="mt-6">
        <EditSignupForm
          signupId={signup.id}
          holidayId={signup.holidayId}
          holidayNameEn={signup.holiday.nameEn}
          memberPriceAgorot={signup.holiday.memberPriceAgorot}
          nonMemberPriceAgorot={signup.holiday.nonMemberPriceAgorot}
          billStatus={bill.status}
          initial={{
            fullName: bill.fullName,
            phone: bill.phone,
            email: bill.email ?? "",
            isMember: bill.isMember,
            notes: bill.notes ?? "",
            menSeats: signup.menSeats,
            womenSeats: signup.womenSeats,
          }}
          otherLineItems={otherLineItems}
        />
      </div>
    </div>
  );
}

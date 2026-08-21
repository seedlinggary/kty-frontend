import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { buildPaymentLink } from "@/lib/nedarim";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import {
  markSignupPaidAction,
  cancelSignupAction,
  reopenSignupAction,
} from "@/lib/actions/signup-admin";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  return { title: holiday ? `Signups — ${holiday.nameEn}` : "Signups" };
}

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function HolidaySignupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const holiday = await prisma.holiday.findUnique({
    where: { id },
    include: {
      signups: {
        orderBy: { createdAt: "desc" },
        include: {
          bill: {
            include: {
              transactions: true,
              lineItems: { include: { holiday: true } },
            },
          },
        },
      },
    },
  });
  if (!holiday) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Signups — {holiday.nameEn}
          </h1>
          <p className="text-sm text-ink/50">{holiday.signups.length} total</p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/admin/holidays/${holiday.id}/signups/export`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
          >
            Export CSV
          </a>
          <Link
            href={`/admin/holidays/${holiday.id}/signups/new`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
          >
            + Create Bill
          </Link>
          <Link
            href={`/admin/holidays/${holiday.id}`}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
          >
            Back to Holiday
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Seats (M/W)</th>
              <th className="px-4 py-3">Line Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Bill</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holiday.signups.map((s) => {
              const bill = s.bill;
              const otherHolidays = bill.lineItems
                .filter((item) => item.holidayId !== holiday.id)
                .map((item) => item.holiday.nameEn);

              const paymentLink =
                bill.status === "PENDING"
                  ? buildPaymentLink({
                      billId: bill.referenceCode,
                      amountAgorot: bill.totalAgorot,
                      clientName: bill.fullName,
                      phone: bill.phone,
                      email: bill.email,
                      groupe: bill.lineItems.map((item) => item.holiday.nameEn).join(" + "),
                    })
                  : null;
              const lastTransaction = bill.transactions[bill.transactions.length - 1];

              return (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-medium text-ink">
                    {bill.fullName}
                    {bill.notes && (
                      <p className="mt-1 text-xs font-normal text-ink/50">{bill.notes}</p>
                    )}
                    {otherHolidays.length > 0 && (
                      <p className="mt-1 text-xs font-normal text-accent">
                        Also includes: {otherHolidays.join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <p>{bill.phone}</p>
                    {bill.email && <p className="text-xs text-ink/50">{bill.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{bill.isMember ? "Member" : "Non-member"}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {s.menSeats} / {s.womenSeats}
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">
                    {formatAgorotAsILS(s.totalAgorot)}
                    {otherHolidays.length > 0 && (
                      <p className="text-xs font-normal text-ink/50">
                        Bill total: {formatAgorotAsILS(bill.totalAgorot)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[bill.status]}`}
                    >
                      {bill.status}
                    </span>
                    {bill.status === "PAID" && lastTransaction?.confirmation && (
                      <p className="mt-1 text-xs text-ink/50">Conf: {lastTransaction.confirmation}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink/60">
                    BILL-{bill.referenceCode}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {paymentLink && <CopyLinkButton link={paymentLink} />}
                      {bill.status === "PENDING" && (
                        <form action={markSignupPaidAction} className="flex items-center gap-1">
                          <input type="hidden" name="billId" value={bill.id} />
                          <input
                            type="text"
                            name="confirmation"
                            placeholder="Conf #"
                            className="w-20 rounded border border-line px-1.5 py-1 text-xs"
                          />
                          <button
                            type="submit"
                            className="rounded bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800"
                          >
                            Mark Paid
                          </button>
                        </form>
                      )}
                      {bill.status !== "CANCELLED" && (
                        <form action={cancelSignupAction}>
                          <input type="hidden" name="billId" value={bill.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                      {bill.status === "CANCELLED" && (
                        <form action={reopenSignupAction}>
                          <input type="hidden" name="billId" value={bill.id} />
                          <button type="submit" className="text-xs font-medium text-ink hover:underline">
                            Reopen
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {holiday.signups.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                  No signups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

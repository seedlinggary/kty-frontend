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
      signups: { orderBy: { createdAt: "desc" }, include: { transactions: true } },
    },
  });
  if (!holiday) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-navy">
            Signups — {holiday.nameEn}
          </h1>
          <p className="text-sm text-ink/50">{holiday.signups.length} total</p>
        </div>
        <div className="flex gap-3">
          <a
            href={`/admin/holidays/${holiday.id}/signups/export`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-alt"
          >
            Export CSV
          </a>
          <Link
            href={`/admin/holidays/${holiday.id}/signups/new`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-alt"
          >
            + Create Bill
          </Link>
          <Link
            href={`/admin/holidays/${holiday.id}`}
            className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-cream hover:bg-navy-light"
          >
            Back to Holiday
          </Link>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-alt text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Seats (M/W)</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Bill</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holiday.signups.map((s) => {
              const paymentLink =
                s.status === "PENDING"
                  ? buildPaymentLink({
                      billId: s.billId,
                      amountAgorot: s.totalAgorot,
                      clientName: s.fullName,
                      phone: s.phone,
                      email: s.email,
                      groupe: holiday.nameEn,
                    })
                  : null;
              const lastTransaction = s.transactions[s.transactions.length - 1];

              return (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 font-medium text-navy">
                    {s.fullName}
                    {s.notes && <p className="mt-1 text-xs font-normal text-ink/50">{s.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink/70">
                    <p>{s.phone}</p>
                    {s.email && <p className="text-xs text-ink/50">{s.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink/70">{s.isMember ? "Member" : "Non-member"}</td>
                  <td className="px-4 py-3 text-ink/70">
                    {s.menSeats} / {s.womenSeats}
                  </td>
                  <td className="px-4 py-3 font-medium text-navy">
                    {formatAgorotAsILS(s.totalAgorot)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[s.status]}`}
                    >
                      {s.status}
                    </span>
                    {s.status === "PAID" && lastTransaction?.confirmation && (
                      <p className="mt-1 text-xs text-ink/50">Conf: {lastTransaction.confirmation}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink/60">BILL-{s.billId}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {paymentLink && <CopyLinkButton link={paymentLink} />}
                      {s.status === "PENDING" && (
                        <form action={markSignupPaidAction} className="flex items-center gap-1">
                          <input type="hidden" name="signupId" value={s.id} />
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
                      {s.status !== "CANCELLED" && (
                        <form action={cancelSignupAction}>
                          <input type="hidden" name="signupId" value={s.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                      {s.status === "CANCELLED" && (
                        <form action={reopenSignupAction}>
                          <input type="hidden" name="signupId" value={s.id} />
                          <button type="submit" className="text-xs font-medium text-navy hover:underline">
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

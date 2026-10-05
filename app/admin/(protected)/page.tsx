import type { Metadata } from "next";
import Link from "next/link";
import { getHolidaysWithStats } from "@/lib/dashboard";
import { formatAgorotAsILS } from "@/lib/money";
import { isNedarimConfigured } from "@/lib/nedarim";
import { isEmailConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const holidays = await getHolidaysWithStats();
  const nedarimReady = isNedarimConfigured();
  const emailReady = isEmailConfigured();

  const [donationTotal, activeMembers, openFollowUps, otherTransactionTotal] = await Promise.all([
    prisma.donation.aggregate({ where: { status: "PAID" }, _sum: { amountAgorot: true } }),
    prisma.membership.count({ where: { status: "ACTIVE" } }),
    prisma.paymentFollowUp.count({ where: { status: { in: ["OPEN", "EMAIL_SENT"] } } }),
    prisma.externalTransaction.aggregate({ _sum: { amountAgorot: true }, _count: true }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Dashboard</h1>
        <Link
          href="/admin/holidays/new"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          + New Holiday
        </Link>
      </div>

      {!nedarimReady && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink">
          NedarimPlus isn&apos;t configured yet (<code>NEDARIM_MOSAD</code> /{" "}
          <code>NEDARIM_APIVALID</code>). Signups still work, but payment links won&apos;t be
          generated until those are set in your environment variables.
        </div>
      )}
      {!emailReady && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-ink">
          Email isn&apos;t configured yet (<code>SMTP_HOST</code> / <code>SMTP_USER</code> /{" "}
          <code>SMTP_PASSWORD</code>). Payment follow-up emails can&apos;t be sent until those are
          set.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link href="/admin/donations" className="rounded-xl border border-line bg-white p-5 hover:border-accent">
          <Stat label="Donations Received" value={formatAgorotAsILS(donationTotal._sum.amountAgorot ?? 0)} />
        </Link>
        <Link href="/admin/memberships" className="rounded-xl border border-line bg-white p-5 hover:border-accent">
          <Stat label="Active Members" value={activeMembers} />
        </Link>
        <Link href="/admin/payment-follow-ups" className="rounded-xl border border-line bg-white p-5 hover:border-accent">
          <Stat label="Open Payment Follow-Ups" value={openFollowUps} />
        </Link>
        <Link href="/admin/payment-links" className="rounded-xl border border-line bg-white p-5 hover:border-accent">
          <Stat label="Payment Links" value="Manage" />
        </Link>
        <Link href="/admin/other-transactions" className="rounded-xl border border-line bg-white p-5 hover:border-accent">
          <Stat
            label={`Other Transactions (${otherTransactionTotal._count})`}
            value={formatAgorotAsILS(otherTransactionTotal._sum.amountAgorot ?? 0)}
          />
        </Link>
      </div>

      {holidays.length === 0 ? (
        <p className="mt-10 text-ink/60">
          No holidays yet.{" "}
          <Link href="/admin/holidays/new" className="text-ink underline">
            Create your first one
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {holidays.map((h) => (
            <Link
              key={h.id}
              href={`/admin/holidays/${h.id}`}
              className="block rounded-xl border border-line bg-white p-6 hover:border-accent"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-serif text-xl font-semibold text-ink">{h.nameEn}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    h.isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {h.isOpen ? "Open" : "Closed"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <Stat label="Men's Seats" value={h.totalMenSeats} />
                <Stat label="Women's Seats" value={h.totalWomenSeats} />
                <Stat label="Paid" value={h.paidCount} />
                <Stat label="Pending" value={h.pendingCount} />
                <Stat label="Paid Revenue" value={formatAgorotAsILS(h.paidRevenueAgorot)} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

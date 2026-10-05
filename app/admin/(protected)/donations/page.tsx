import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { markDonationPaidAction, cancelDonationAction } from "@/lib/actions/payment-admin";
import { flagForFollowUpAction } from "@/lib/actions/payment-follow-ups";
import type { BillStatus, Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = { title: "Donations" };

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status ?? "ALL";

  const where: Prisma.DonationWhereInput = {};
  if (statusFilter !== "ALL") where.status = statusFilter as BillStatus;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  const donations = await prisma.donation.findMany({ where, orderBy: { createdAt: "desc" } });
  const totalPaid = donations.filter((d) => d.status === "PAID").reduce((sum, d) => sum + d.amountAgorot, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Donations</h1>
          <p className="text-sm text-ink/60">
            {donations.length} shown · {formatAgorotAsILS(totalPaid)} received
          </p>
        </div>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Name, email, or phone"
            className="w-56 rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Status</label>
          <select name="status" defaultValue={statusFilter} className="rounded-md border border-line px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent">
          Apply
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Purpose</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((d) => (
              <tr key={d.id} className="border-t border-line align-top">
                <td className="px-4 py-3 font-medium text-ink">{d.fullName}</td>
                <td className="px-4 py-3 text-ink/70">
                  <p>{d.email}</p>
                  {d.phone && <p className="text-xs text-ink/50">{d.phone}</p>}
                  {(d.address || d.city) && (
                    <p className="text-xs text-ink/50">{[d.address, d.city].filter(Boolean).join(", ")}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70">{d.purpose || "—"}</td>
                <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(d.amountAgorot)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[d.status]}`}>{d.status}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink/60">DON-{d.referenceCode}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {d.status === "PENDING" && (
                      <form action={markDonationPaidAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className="rounded bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800">
                          Mark Paid
                        </button>
                      </form>
                    )}
                    {d.status !== "CANCELLED" && (
                      <form action={cancelDonationAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                          Cancel
                        </button>
                      </form>
                    )}
                    {d.status === "PENDING" && (
                      <form action={flagForFollowUpAction}>
                        <input type="hidden" name="kind" value="donation" />
                        <input type="hidden" name="id" value={d.id} />
                        <ConfirmSubmitButton
                          confirmMessage="Flag this donation for payment follow-up?"
                          className="text-xs font-medium text-amber-700 hover:underline"
                        >
                          Flag Failed
                        </ConfirmSubmitButton>
                      </form>
                    )}
                    {isSuperAdmin && (
                      <Link href={`/admin/donations/${d.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                        Edit (Override)
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {donations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink/50">No donations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

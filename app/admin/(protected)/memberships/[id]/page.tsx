import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin-dates";

export const metadata: Metadata = { title: "Membership Payment History" };

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  PAST_DUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function MembershipHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";

  const { id } = await params;
  const membership = await prisma.membership.findUnique({
    where: { id },
    include: {
      transactions: { orderBy: { receivedAt: "desc" } },
      followUps: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!membership) notFound();

  const totalCollected = membership.transactions.reduce((sum, t) => sum + t.amountAgorot, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{membership.fullName}</h1>
          <p className="mt-1 text-sm text-ink/60">MEM-{membership.referenceCode}</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/memberships" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale">
            Back to Memberships
          </Link>
          {isSuperAdmin && (
            <Link href={`/admin/memberships/${membership.id}/edit`} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent">
              Edit (Override)
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-white p-6 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Status</p>
          <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[membership.status]}`}>
            {membership.status.replace("_", " ")}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Tier</p>
          <p className="mt-1 text-lg font-semibold text-ink">{membership.tier === "FULL" ? "Full" : "Associate"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Monthly Amount</p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatAgorotAsILS(membership.monthlyAgorot)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Total Collected</p>
          <p className="mt-1 text-lg font-semibold text-ink">{formatAgorotAsILS(totalCollected)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Email</p>
          <p className="mt-1 text-ink">{membership.email}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Phone</p>
          <p className="mt-1 text-ink">{membership.phone || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Address</p>
          <p className="mt-1 text-ink">{membership.address || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Next Charge</p>
          <p className="mt-1 text-ink">{membership.nextChargeDate ? formatAdminDate(membership.nextChargeDate) : "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Standing Order ID</p>
          <p className="mt-1 font-mono text-xs text-ink/70">{membership.kevaId || "Not yet established"}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Member Since</p>
          <p className="mt-1 text-ink">{formatAdminDate(membership.createdAt)}</p>
        </div>
        {(membership.nedarimPaymentsMade != null || membership.nedarimPaymentsRemaining != null) && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink/50">Payment Term (per NedarimPlus)</p>
            <p className="mt-1 text-ink">
              {membership.nedarimPaymentsMade ?? 0} made
              {membership.nedarimPaymentsRemaining ? `, ${membership.nedarimPaymentsRemaining} remaining` : " · no fixed end reported"}
            </p>
          </div>
        )}
      </div>

      {membership.status === "PAST_DUE" && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          Past Due means either NedarimPlus reported a decline on this standing order&apos;s last
          charge attempt, or an expected charge simply never arrived by its next-charge date (our
          own daily check, since NedarimPlus doesn&apos;t always report a decline directly for
          every case).
        </p>
      )}

      <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Payment History</h2>
      <p className="mt-1 text-sm text-ink/60">Every successful charge NedarimPlus has reported for this standing order.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Confirmation</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">NedarimPlus Transaction ID</th>
            </tr>
          </thead>
          <tbody>
            {membership.transactions.map((t) => (
              <tr key={t.id} className="border-t border-line">
                <td className="px-4 py-3 text-ink/70">{formatAdminDateTime(t.receivedAt)}</td>
                <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(t.amountAgorot)}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/60">{t.confirmation || "—"}</td>
                <td className="px-4 py-3 text-ink/70">{t.source}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/60">{t.nedarimTransactionId || "—"}</td>
              </tr>
            ))}
            {membership.transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">No charges recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {membership.followUps.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Payment Issues</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Flagged</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {membership.followUps.map((f) => (
                  <tr key={f.id} className="border-t border-line">
                    <td className="px-4 py-3 text-ink/70">{formatAdminDate(f.createdAt)}</td>
                    <td className="px-4 py-3 text-ink/70">{f.reason.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-ink/70">{f.failureReason || f.notes || "—"}</td>
                    <td className="px-4 py-3 text-ink/70">{f.status.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

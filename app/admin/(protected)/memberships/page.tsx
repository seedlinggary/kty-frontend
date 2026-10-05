import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { cancelMembershipAction, reactivateMembershipAction } from "@/lib/actions/payment-admin";
import { flagForFollowUpAction } from "@/lib/actions/payment-follow-ups";
import type { MembershipStatus, Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = { title: "Memberships" };

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  PAST_DUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status ?? "ALL";

  const where: Prisma.MembershipWhereInput = {};
  if (statusFilter !== "ALL") where.status = statusFilter as MembershipStatus;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }

  const memberships = await prisma.membership.findMany({ where, orderBy: { createdAt: "desc" } });
  const activeCount = memberships.filter((m) => m.status === "ACTIVE").length;
  const monthlyTotal = memberships
    .filter((m) => m.status === "ACTIVE")
    .reduce((sum, m) => sum + m.monthlyAgorot, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Memberships</h1>
          <p className="text-sm text-ink/60">
            {activeCount} active · {formatAgorotAsILS(monthlyTotal)}/month expected
          </p>
        </div>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Search</label>
          <input type="text" name="q" defaultValue={q} placeholder="Name, email, or phone" className="w-56 rounded-md border border-line px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Status</label>
          <select name="status" defaultValue={statusFilter} className="rounded-md border border-line px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="PAST_DUE">Past Due</option>
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
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Monthly</th>
              <th className="px-4 py-3">Next Charge</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <tr key={m.id} className="border-t border-line align-top">
                <td className="px-4 py-3 font-medium text-ink">{m.fullName}</td>
                <td className="px-4 py-3 text-ink/70">
                  <p>{m.email}</p>
                  {m.phone && <p className="text-xs text-ink/50">{m.phone}</p>}
                  {(m.address || m.city) && (
                    <p className="text-xs text-ink/50">{[m.address, m.city].filter(Boolean).join(", ")}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70">{m.tier === "FULL" ? "Full" : "Associate"}</td>
                <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(m.monthlyAgorot)}</td>
                <td className="px-4 py-3 text-ink/70">{m.nextChargeDate ? m.nextChargeDate.toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[m.status]}`}>{m.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink/60">MEM-{m.referenceCode}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {m.status !== "CANCELLED" && (
                      <form action={cancelMembershipAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">Cancel</button>
                      </form>
                    )}
                    {(m.status === "PAST_DUE" || m.status === "CANCELLED") && (
                      <form action={reactivateMembershipAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" className="text-xs font-medium text-ink hover:underline">Reactivate</button>
                      </form>
                    )}
                    {(m.status === "PENDING" || m.status === "PAST_DUE") && (
                      <form action={flagForFollowUpAction}>
                        <input type="hidden" name="kind" value="membership" />
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" className="text-xs font-medium text-amber-700 hover:underline">Flag Failed</button>
                      </form>
                    )}
                    <Link href={`/admin/memberships/${m.id}`} className="text-xs font-medium text-ink hover:underline">
                      Payment History
                    </Link>
                    {isSuperAdmin && (
                      <Link href={`/admin/memberships/${m.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                        Edit (Override)
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {memberships.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">No memberships yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

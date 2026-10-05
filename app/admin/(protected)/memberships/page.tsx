import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { cancelMembershipAction, reactivateMembershipAction } from "@/lib/actions/payment-admin";
import { flagForFollowUpAction } from "@/lib/actions/payment-follow-ups";
import type { MembershipStatus, Prisma } from "@/lib/generated/prisma/client";
import { MergeForm, MergeCheckbox, MergeErrorBanner, PersonBadge } from "@/components/admin/person-merge-ui";
import { GroupByPersonToggle } from "@/components/admin/group-by-person-toggle";
import { groupByPerson } from "@/lib/people-grouping";
import { ImportNedarimMembersButton } from "@/components/admin/import-nedarim-members-button";
import { isNedarimReportingConfigured } from "@/lib/nedarim-reports";
import { formatAdminDate } from "@/lib/admin-dates";
import { SortHeader } from "@/components/admin/sort-header";
import { buildSortHref, nextSortDir, type SortDir } from "@/lib/sort-params";

export const metadata: Metadata = { title: "Memberships" };

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  PAST_DUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

type MembershipRow = Prisma.MembershipGetPayload<{ include: { person: { select: { id: true; fullName: true } } } }>;

const SORT_COLUMNS = ["since", "name", "tier", "monthly", "next", "status"] as const;
type SortKey = (typeof SORT_COLUMNS)[number];

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string; mergeError?: string; sort?: string; dir?: string }>;
}) {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status ?? "ALL";
  const grouped = sp.view !== "raw";
  const sortKey: SortKey = SORT_COLUMNS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "since";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

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

  const fetched = await prisma.membership.findMany({
    where,
    include: { person: { select: { id: true, fullName: true } } },
  });
  const activeCount = fetched.filter((m) => m.status === "ACTIVE").length;
  const monthlyTotal = fetched.filter((m) => m.status === "ACTIVE").reduce((sum, m) => sum + m.monthlyAgorot, 0);

  const direction = dir === "asc" ? 1 : -1;
  const memberships = [...fetched].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return direction * a.fullName.localeCompare(b.fullName);
      case "tier":
        return direction * a.tier.localeCompare(b.tier);
      case "monthly":
        return direction * (a.monthlyAgorot - b.monthlyAgorot);
      case "next":
        return direction * ((a.nextChargeDate?.getTime() ?? 0) - (b.nextChargeDate?.getTime() ?? 0));
      case "status":
        return direction * a.status.localeCompare(b.status);
      case "since":
      default:
        return direction * (a.createdAt.getTime() - b.createdAt.getTime());
    }
  });

  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  if (statusFilter !== "ALL") redirectParams.set("status", statusFilter);
  const redirectQs = redirectParams.toString();
  const redirectTo = `/admin/memberships${redirectQs ? `?${redirectQs}` : ""}`;

  const { groups, ungrouped } = groupByPerson(memberships, (m) => m.person);

  function sortHref(column: SortKey) {
    return buildSortHref("/admin/memberships", sp, { sort: column, dir: nextSortDir(sortKey, dir, column) });
  }

  function TableHead() {
    return (
      <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
        <tr>
          <th className="px-4 py-3" />
          <th className="px-4 py-3">
            <SortHeader href={sortHref("since")} isActive={sortKey === "since"} dir={dir}>Member Since</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("name")} isActive={sortKey === "name"} dir={dir}>Name</SortHeader>
          </th>
          <th className="px-4 py-3">Contact</th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("tier")} isActive={sortKey === "tier"} dir={dir}>Tier</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("monthly")} isActive={sortKey === "monthly"} dir={dir}>Monthly</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("next")} isActive={sortKey === "next"} dir={dir}>Next Charge</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("status")} isActive={sortKey === "status"} dir={dir}>Status</SortHeader>
          </th>
          <th className="px-4 py-3">Reference</th>
          <th className="px-4 py-3">Actions</th>
        </tr>
      </thead>
    );
  }

  function Row({ m }: { m: MembershipRow }) {
    return (
      <tr key={m.id} className="border-t border-line align-top">
        <td className="px-4 py-3">
          <MergeCheckbox kind="membership" id={m.id} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-ink/70">{formatAdminDate(m.createdAt)}</td>
        <td className="px-4 py-3 font-medium text-ink">
          {m.fullName}
          <div>
            <PersonBadge person={m.person} />
          </div>
        </td>
        <td className="px-4 py-3 text-ink/70">
          <p>{m.email}</p>
          {m.phone && <p className="text-xs text-ink/50">{m.phone}</p>}
          {(m.address || m.city) && (
            <p className="text-xs text-ink/50">{[m.address, m.city].filter(Boolean).join(", ")}</p>
          )}
        </td>
        <td className="px-4 py-3 text-ink/70">{m.tier === "FULL" ? "Full" : "Associate"}</td>
        <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(m.monthlyAgorot)}</td>
        <td className="px-4 py-3 text-ink/70">{m.nextChargeDate ? formatAdminDate(m.nextChargeDate) : "—"}</td>
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
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Memberships</h1>
          <p className="text-sm text-ink/60">
            {activeCount} active · {formatAgorotAsILS(monthlyTotal)}/month expected
          </p>
        </div>
        <GroupByPersonToggle />
      </div>

      {isSuperAdmin && isNedarimReportingConfigured() && (
        <div className="mt-4 rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-ink/60">
            Pull in any standing order NedarimPlus already has on file - including ones set up
            directly on their site before this system existed - that we don&apos;t have yet, plus
            their past payment history and signup date. This only reads from NedarimPlus
            (GetKevaJson/GetKevaId); nothing is ever written back or changed there. Safe to run
            again any time - anything already imported, or any payment already on file, is
            matched and skipped, never duplicated.
          </p>
          <div className="mt-3">
            <ImportNedarimMembersButton />
          </div>
        </div>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
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

      <MergeErrorBanner show={sp.mergeError === "select-at-least-two"} />

      {memberships.length === 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            {TableHead()}
            <tbody>
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-ink/50">No memberships yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <MergeForm redirectTo={redirectTo} />
          {grouped ? (
            <div className="mt-4 space-y-6">
              {groups.map(({ person, items }) => (
                <div key={person.id} className="overflow-hidden rounded-xl border border-line bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-pale px-4 py-3">
                    <Link href={`/admin/people/${person.id}`} className="font-medium text-ink hover:underline">
                      {person.fullName}
                    </Link>
                    <span className="text-xs text-ink/60">{items.length} membership{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    {TableHead()}
                    <tbody>{items.map((m) => <Row key={m.id} m={m} />)}</tbody>
                  </table>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-ink/60">Not linked to a person ({ungrouped.length})</h2>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
                    <table className="w-full text-left text-sm">
                      {TableHead()}
                      <tbody>{ungrouped.map((m) => <Row key={m.id} m={m} />)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                {TableHead()}
                <tbody>{memberships.map((m) => <Row key={m.id} m={m} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

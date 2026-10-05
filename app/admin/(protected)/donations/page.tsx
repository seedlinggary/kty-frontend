import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { formatAdminDate } from "@/lib/admin-dates";
import { markDonationPaidAction, cancelDonationAction } from "@/lib/actions/payment-admin";
import { flagForFollowUpAction } from "@/lib/actions/payment-follow-ups";
import type { BillStatus, Prisma } from "@/lib/generated/prisma/client";
import { MergeForm, MergeCheckbox, MergeErrorBanner, PersonBadge } from "@/components/admin/person-merge-ui";
import { GroupByPersonToggle } from "@/components/admin/group-by-person-toggle";
import { groupByPerson } from "@/lib/people-grouping";
import { SortHeader } from "@/components/admin/sort-header";
import { buildSortHref, nextSortDir, type SortDir } from "@/lib/sort-params";

export const metadata: Metadata = { title: "Donations" };

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

type DonationRow = Prisma.DonationGetPayload<{ include: { person: { select: { id: true; fullName: true } } } }>;

const SORT_COLUMNS = ["date", "name", "purpose", "amount", "status"] as const;
type SortKey = (typeof SORT_COLUMNS)[number];

export default async function DonationsPage({
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
  const sortKey: SortKey = SORT_COLUMNS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "date";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

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

  const fetched = await prisma.donation.findMany({
    where,
    include: { person: { select: { id: true, fullName: true } } },
  });
  const totalPaid = fetched.filter((d) => d.status === "PAID").reduce((sum, d) => sum + d.amountAgorot, 0);

  const direction = dir === "asc" ? 1 : -1;
  const donations = [...fetched].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return direction * a.fullName.localeCompare(b.fullName);
      case "purpose":
        return direction * (a.purpose || "").localeCompare(b.purpose || "");
      case "amount":
        return direction * (a.amountAgorot - b.amountAgorot);
      case "status":
        return direction * a.status.localeCompare(b.status);
      case "date":
      default:
        return direction * (a.createdAt.getTime() - b.createdAt.getTime());
    }
  });

  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  if (statusFilter !== "ALL") redirectParams.set("status", statusFilter);
  const redirectQs = redirectParams.toString();
  const redirectTo = `/admin/donations${redirectQs ? `?${redirectQs}` : ""}`;

  const { groups, ungrouped } = groupByPerson(donations, (d) => d.person);

  function sortHref(column: SortKey) {
    return buildSortHref("/admin/donations", sp, { sort: column, dir: nextSortDir(sortKey, dir, column) });
  }

  function TableHead() {
    return (
      <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
        <tr>
          <th className="px-4 py-3" />
          <th className="px-4 py-3">
            <SortHeader href={sortHref("date")} isActive={sortKey === "date"} dir={dir}>Date</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("name")} isActive={sortKey === "name"} dir={dir}>Name</SortHeader>
          </th>
          <th className="px-4 py-3">Contact</th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("purpose")} isActive={sortKey === "purpose"} dir={dir}>Purpose</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("amount")} isActive={sortKey === "amount"} dir={dir}>Amount</SortHeader>
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

  function Row({ d }: { d: DonationRow }) {
    return (
      <tr key={d.id} className="border-t border-line align-top">
        <td className="px-4 py-3">
          <MergeCheckbox kind="donation" id={d.id} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-ink/70">{formatAdminDate(d.createdAt)}</td>
        <td className="px-4 py-3 font-medium text-ink">
          {d.fullName}
          <div>
            <PersonBadge person={d.person} />
          </div>
        </td>
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
                <button type="submit" className="text-xs font-medium text-amber-700 hover:underline">
                  Flag Failed
                </button>
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
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Donations</h1>
          <p className="text-sm text-ink/60">
            {donations.length} shown · {formatAgorotAsILS(totalPaid)} received
          </p>
        </div>
        <GroupByPersonToggle />
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
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

      <MergeErrorBanner show={sp.mergeError === "select-at-least-two"} />

      {donations.length === 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            {TableHead()}
            <tbody>
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink/50">No donations yet.</td>
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
                    <span className="text-xs text-ink/60">{items.length} donation{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    {TableHead()}
                    <tbody>{items.map((d) => <Row key={d.id} d={d} />)}</tbody>
                  </table>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-ink/60">Not linked to a person ({ungrouped.length})</h2>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
                    <table className="w-full text-left text-sm">
                      {TableHead()}
                      <tbody>{ungrouped.map((d) => <Row key={d.id} d={d} />)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                {TableHead()}
                <tbody>{donations.map((d) => <Row key={d.id} d={d} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { formatAdminDateTime } from "@/lib/admin-dates";
import { MergeForm, MergeCheckbox, MergeErrorBanner, PersonBadge } from "@/components/admin/person-merge-ui";
import { GroupByPersonToggle } from "@/components/admin/group-by-person-toggle";
import { groupByPerson } from "@/lib/people-grouping";
import { SortHeader } from "@/components/admin/sort-header";
import { buildSortHref, nextSortDir, type SortDir } from "@/lib/sort-params";
import type { Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = { title: "Other NedarimPlus Transactions" };

type TransactionRow = Prisma.ExternalTransactionGetPayload<{ include: { person: { select: { id: true; fullName: true } } } }>;

const SORT_COLUMNS = ["date", "name", "amount", "category"] as const;
type SortKey = (typeof SORT_COLUMNS)[number];

export default async function OtherTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; mergeError?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const grouped = sp.view !== "raw";
  const sortKey: SortKey = SORT_COLUMNS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "date";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

  const fetched = await prisma.externalTransaction.findMany({
    where: q
      ? {
          OR: [
            { clientName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { comments: { contains: q, mode: "insensitive" } },
            { groupe: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { person: { select: { id: true, fullName: true } } },
    take: 500,
  });

  const total = fetched.reduce((sum, t) => sum + t.amountAgorot, 0);

  const direction = dir === "asc" ? 1 : -1;
  const transactions = [...fetched].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return direction * (a.clientName || "").localeCompare(b.clientName || "");
      case "amount":
        return direction * (a.amountAgorot - b.amountAgorot);
      case "category":
        return direction * (a.groupe || "").localeCompare(b.groupe || "");
      case "date":
      default:
        return direction * (a.receivedAt.getTime() - b.receivedAt.getTime());
    }
  });

  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  const redirectQs = redirectParams.toString();
  const redirectTo = `/admin/other-transactions${redirectQs ? `?${redirectQs}` : ""}`;

  const { groups, ungrouped } = groupByPerson(transactions, (t) => t.person);

  function sortHref(column: SortKey) {
    return buildSortHref("/admin/other-transactions", sp, { sort: column, dir: nextSortDir(sortKey, dir, column) });
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
            <SortHeader href={sortHref("amount")} isActive={sortKey === "amount"} dir={dir}>Amount</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("category")} isActive={sortKey === "category"} dir={dir}>Category / Comment</SortHeader>
          </th>
          <th className="px-4 py-3">Standing Order</th>
          <th className="px-4 py-3">Confirmation</th>
        </tr>
      </thead>
    );
  }

  function Row({ t }: { t: TransactionRow }) {
    return (
      <tr key={t.id} className="border-t border-line align-top">
        <td className="px-4 py-3">
          <MergeCheckbox kind="externalTransaction" id={t.id} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-ink/70">{formatAdminDateTime(t.receivedAt)}</td>
        <td className="px-4 py-3 font-medium text-ink">
          {t.clientName || "—"}
          <div>
            <PersonBadge person={t.person} />
          </div>
        </td>
        <td className="px-4 py-3 text-ink/70">
          {t.phone && <p>{t.phone}</p>}
          {t.email && <p className="text-xs text-ink/50">{t.email}</p>}
        </td>
        <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(t.amountAgorot)}</td>
        <td className="px-4 py-3 text-ink/70">
          {t.groupe && <p>{t.groupe}</p>}
          {t.comments && <p className="text-xs text-ink/50">{t.comments}</p>}
        </td>
        <td className="px-4 py-3 text-ink/70">{t.kevaId ? "Yes" : "—"}</td>
        <td className="px-4 py-3 font-mono text-xs text-ink/60">{t.confirmation || "—"}</td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Other NedarimPlus Transactions</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            Successful NedarimPlus payments that didn&apos;t come through one of our own forms or
            admin-created links - a pre-existing standing order set up directly in NedarimPlus, or any
            other payment link shared outside this app. Kept here so nothing coming through the Mosad
            goes untracked.
          </p>
          <p className="mt-2 text-sm text-ink/60">
            {transactions.length} shown · {formatAgorotAsILS(total)} total
          </p>
        </div>
        <GroupByPersonToggle />
      </div>

      <form method="get" className="mt-6 flex items-end gap-3">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name, email, phone, or comment"
          className="w-64 rounded-md border border-line px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent">
          Search
        </button>
      </form>

      <MergeErrorBanner show={sp.mergeError === "select-at-least-two"} />

      {transactions.length === 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            {TableHead()}
            <tbody>
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink/50">
                  Nothing here yet - every NedarimPlus payment so far has come through one of our
                  own links.
                </td>
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
                    <span className="text-xs text-ink/60">{items.length} transaction{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    {TableHead()}
                    <tbody>{items.map((t) => <Row key={t.id} t={t} />)}</tbody>
                  </table>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-ink/60">Not linked to a person ({ungrouped.length})</h2>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
                    <table className="w-full text-left text-sm">
                      {TableHead()}
                      <tbody>{ungrouped.map((t) => <Row key={t.id} t={t} />)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                {TableHead()}
                <tbody>{transactions.map((t) => <Row key={t.id} t={t} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

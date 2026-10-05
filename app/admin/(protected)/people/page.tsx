import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { mergeIntoPersonAction } from "@/lib/actions/people";
import { findMergeRecommendations } from "@/lib/merge-recommendations";
import { SortHeader } from "@/components/admin/sort-header";
import { buildSortHref, nextSortDir, type SortDir } from "@/lib/sort-params";
import { formatAdminDate } from "@/lib/admin-dates";

export const metadata: Metadata = { title: "People" };

const SORT_COLUMNS = ["updated", "name", "bills", "donations", "memberships", "paymentLinks", "formResponses", "externalTransactions"] as const;
type SortKey = (typeof SORT_COLUMNS)[number];

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sortKey: SortKey = SORT_COLUMNS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "updated";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

  const recommendations = await findMergeRecommendations();

  const fetched = await prisma.person.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      _count: {
        select: {
          bills: true,
          donations: true,
          memberships: true,
          paymentLinks: true,
          formResponses: true,
          externalTransactions: true,
        },
      },
    },
  });

  const direction = dir === "asc" ? 1 : -1;
  const people = [...fetched].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return direction * a.fullName.localeCompare(b.fullName);
      case "bills":
        return direction * (a._count.bills - b._count.bills);
      case "donations":
        return direction * (a._count.donations - b._count.donations);
      case "memberships":
        return direction * (a._count.memberships - b._count.memberships);
      case "paymentLinks":
        return direction * (a._count.paymentLinks - b._count.paymentLinks);
      case "formResponses":
        return direction * (a._count.formResponses - b._count.formResponses);
      case "externalTransactions":
        return direction * (a._count.externalTransactions - b._count.externalTransactions);
      case "updated":
      default:
        return direction * (a.updatedAt.getTime() - b.updatedAt.getTime());
    }
  });

  function sortHref(column: SortKey) {
    return buildSortHref("/admin/people", sp, { sort: column, dir: nextSortDir(sortKey, dir, column) });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">People</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            Combined individuals created by merging records on{" "}
            <Link href="/admin/search" className="text-accent hover:underline">
              Search
            </Link>
            {" "}or any admin list page. Each one brings together every signup, donation,
            membership, payment link, and form submission that&apos;s been linked to the same
            real person.
          </p>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-6">
          <h2 className="font-serif text-lg font-semibold text-ink">
            Possible Duplicates <span className="text-sm font-normal text-ink/50">({recommendations.length})</span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            Records that share the same email or phone number but aren&apos;t combined yet - a
            recommendation, not an automatic change. Check it over and combine it, or ignore it if
            it&apos;s a false match (e.g. a shared office email rather than the same individual).
          </p>
          <div className="mt-3 space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.key} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-ink/70">
                    Same {rec.matchedOn.join(" & ")}:{" "}
                    <span className="font-mono text-xs">{rec.sharedValues.join(", ")}</span>
                    {rec.existingPersonNames.length > 0 && (
                      <> · already linked to {rec.existingPersonNames.join(", ")}</>
                    )}
                  </p>
                  <form action={mergeIntoPersonAction}>
                    <input type="hidden" name="redirectTo" value="/admin/people" />
                    {rec.items.map((item) => (
                      <input key={item.id} type="hidden" name="items" value={`${item.kind}:${item.id}`} />
                    ))}
                    <button
                      type="submit"
                      className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent"
                    >
                      Combine These {rec.items.length}
                    </button>
                  </form>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-ink/70">
                  {rec.items.map((item) => (
                    <li key={item.id}>
                      {item.label}
                      {item.personName && (
                        <span className="ml-2 text-xs text-accent">(currently part of {item.personName})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <form method="get" className="mt-6 flex items-end gap-3">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name, email, or phone"
          className="w-64 rounded-md border border-line px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent">
          Search
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("name")} isActive={sortKey === "name"} dir={dir}>Name</SortHeader>
              </th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("bills")} isActive={sortKey === "bills"} dir={dir}>Holiday Seats</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("donations")} isActive={sortKey === "donations"} dir={dir}>Donations</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("memberships")} isActive={sortKey === "memberships"} dir={dir}>Memberships</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("paymentLinks")} isActive={sortKey === "paymentLinks"} dir={dir}>Payment Links</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("formResponses")} isActive={sortKey === "formResponses"} dir={dir}>Form Submissions</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("externalTransactions")} isActive={sortKey === "externalTransactions"} dir={dir}>Other</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("updated")} isActive={sortKey === "updated"} dir={dir}>Last Updated</SortHeader>
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="px-4 py-3 font-medium text-ink">{p.fullName}</td>
                <td className="px-4 py-3 text-ink/70">
                  {p.email && <p>{p.email}</p>}
                  {p.phone && <p className="text-xs text-ink/50">{p.phone}</p>}
                </td>
                <td className="px-4 py-3 text-ink/70">{p._count.bills}</td>
                <td className="px-4 py-3 text-ink/70">{p._count.donations}</td>
                <td className="px-4 py-3 text-ink/70">{p._count.memberships}</td>
                <td className="px-4 py-3 text-ink/70">{p._count.paymentLinks}</td>
                <td className="px-4 py-3 text-ink/70">{p._count.formResponses}</td>
                <td className="px-4 py-3 text-ink/70">{p._count.externalTransactions}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink/70">{formatAdminDate(p.updatedAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/people/${p.id}`} className="text-xs font-medium text-ink hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-ink/50">
                  No combined people yet - merge some matching records from the{" "}
                  <Link href="/admin/search" className="text-accent hover:underline">
                    Search
                  </Link>{" "}
                  page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

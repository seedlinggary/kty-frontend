import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MergeForm } from "@/components/admin/family-merge-ui";
import { findMergeRecommendations } from "@/lib/merge-recommendations";
import { SortHeader } from "@/components/admin/sort-header";
import { buildSortHref, nextSortDir, type SortDir } from "@/lib/sort-params";
import { formatAdminDate } from "@/lib/admin-dates";

export const metadata: Metadata = { title: "Families" };

const SORT_COLUMNS = ["updated", "name", "activeMembership", "donations", "paymentLinks", "formResponses", "externalTransactions"] as const;
type SortKey = (typeof SORT_COLUMNS)[number];

export default async function FamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const sortKey: SortKey = SORT_COLUMNS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "updated";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

  const recommendations = await findMergeRecommendations();

  const fetched = await prisma.family.findMany({
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
          donations: true,
          paymentLinks: true,
          formResponses: true,
          externalTransactions: true,
        },
      },
      memberships: { select: { status: true } },
    },
  });

  const totalFamilies = fetched.length;
  const withActiveMembership = fetched.filter((f) => f.memberships.some((m) => m.status === "ACTIVE")).length;

  const direction = dir === "asc" ? 1 : -1;
  const families = [...fetched].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return direction * a.fullName.localeCompare(b.fullName);
      case "donations":
        return direction * (a._count.donations - b._count.donations);
      case "activeMembership": {
        const aActive = a.memberships.some((m) => m.status === "ACTIVE") ? 1 : 0;
        const bActive = b.memberships.some((m) => m.status === "ACTIVE") ? 1 : 0;
        return direction * (aActive - bActive);
      }
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
    return buildSortHref("/admin/families", sp, { sort: column, dir: nextSortDir(sortKey, dir, column) });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Families</h1>
          <p className="mt-1 text-sm text-ink/60">
            {totalFamilies} families · {withActiveMembership} with an active membership
          </p>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            A household - a husband and wife who each filled out their own form/bill under their own
            name or email are the common case. Combined by merging records on{" "}
            <Link href="/admin/search" className="text-accent hover:underline">
              Search
            </Link>
            {" "}or any admin list page. Each one brings together every signup, donation,
            membership, payment link, and form submission that&apos;s been linked to the same
            household.
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
            recommendation, not an automatic change. Uncheck anything that doesn&apos;t actually
            belong (e.g. a shared office email, or two different household members you want kept
            separate for now) before combining.
          </p>
          <div className="mt-3 space-y-3">
            {recommendations.map((rec) => (
              <div key={rec.key} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-ink/70">
                  Same {rec.matchedOn.join(" & ")}:{" "}
                  <span className="font-mono text-xs">{rec.sharedValues.join(", ")}</span>
                  {rec.existingFamilyNames.length > 0 && (
                    <> · already linked to {rec.existingFamilyNames.join(", ")}</>
                  )}
                </p>
                <MergeForm className="mt-2">
                  <ul className="space-y-1 text-sm text-ink/70">
                    {rec.items.map((item) => (
                      <li key={item.id}>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            name="items"
                            value={`${item.kind}:${item.id}`}
                            defaultChecked
                            className="mt-0.5 h-4 w-4 rounded border-line"
                          />
                          <span>
                            {item.label}
                            {item.familyName && (
                              <span className="ml-2 text-xs text-accent">(currently part of {item.familyName})</span>
                            )}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="submit"
                    className="mt-2 rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent"
                  >
                    Combine Checked
                  </button>
                </MergeForm>
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

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("name")} isActive={sortKey === "name"} dir={dir}>Name</SortHeader>
              </th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("activeMembership")} isActive={sortKey === "activeMembership"} dir={dir}>Active Membership</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("donations")} isActive={sortKey === "donations"} dir={dir}>Donations</SortHeader>
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
            {families.map((f) => (
              <tr key={f.id} className="border-t border-line align-top">
                <td className="px-4 py-3 font-medium text-ink">{f.fullName}</td>
                <td className="px-4 py-3 text-ink/70">
                  {f.email && <p>{f.email}</p>}
                  {f.phone && <p className="text-xs text-ink/50">{f.phone}</p>}
                </td>
                <td className="px-4 py-3">
                  {f.memberships.some((m) => m.status === "ACTIVE") ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Yes</span>
                  ) : (
                    <span className="text-xs text-ink/40">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-ink/70">{f._count.donations}</td>
                <td className="px-4 py-3 text-ink/70">{f._count.paymentLinks}</td>
                <td className="px-4 py-3 text-ink/70">{f._count.formResponses}</td>
                <td className="px-4 py-3 text-ink/70">{f._count.externalTransactions}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink/70">{formatAdminDate(f.updatedAt)}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/families/${f.id}`} className="text-xs font-medium text-ink hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {families.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink/50">
                  No combined families yet - merge some matching records from the{" "}
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

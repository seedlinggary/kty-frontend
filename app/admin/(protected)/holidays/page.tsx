import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";

export const metadata: Metadata = { title: "Holidays" };

export default async function HolidaysListPage() {
  const holidays = await prisma.holiday.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-ink">Holidays</h1>
        <Link
          href="/admin/holidays/new"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          + New Holiday
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Member / Non-Member</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{h.nameEn}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/60">{h.slug}</td>
                <td className="px-4 py-3">
                  {formatAgorotAsILS(h.memberPriceAgorot)} / {formatAgorotAsILS(h.nonMemberPriceAgorot)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      h.isOpen ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {h.isOpen ? "Open" : "Closed"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/holidays/${h.id}`} className="font-medium text-ink hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {holidays.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink/50">
                  No holidays yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

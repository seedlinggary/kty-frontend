import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";

export const metadata: Metadata = { title: "Other NedarimPlus Transactions" };

export default async function OtherTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";

  const transactions = await prisma.externalTransaction.findMany({
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
    orderBy: { receivedAt: "desc" },
    take: 500,
  });

  const total = transactions.reduce((sum, t) => sum + t.amountAgorot, 0);

  return (
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

      <form method="get" className="mt-6 flex items-end gap-3">
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

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Category / Comment</th>
              <th className="px-4 py-3">Standing Order</th>
              <th className="px-4 py-3">Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-line align-top">
                <td className="px-4 py-3 text-ink/70">{t.receivedAt.toLocaleString()}</td>
                <td className="px-4 py-3 font-medium text-ink">{t.clientName || "—"}</td>
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
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink/50">
                  Nothing here yet - every NedarimPlus payment so far has come through one of our
                  own links.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { EditUserForm } from "@/components/admin/edit-user-form";
import { unlinkFromUserAction } from "@/lib/actions/users";
import { AuditHistory } from "@/components/admin/audit-history";

export const metadata: Metadata = { title: "User" };

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      bills: {
        include: { lineItems: { where: { deletedAt: null }, include: { holiday: true } } },
        orderBy: { createdAt: "desc" },
      },
      donations: { orderBy: { createdAt: "desc" } },
      memberships: { include: { transactions: { orderBy: { receivedAt: "desc" } } }, orderBy: { createdAt: "desc" } },
      paymentLinks: { orderBy: { createdAt: "desc" } },
      formResponses: { include: { form: true }, orderBy: { createdAt: "desc" } },
      externalTransactions: { orderBy: { receivedAt: "desc" } },
    },
  });
  if (!user) notFound();

  const auditEntries = await prisma.adminAuditLog.findMany({
    where: { recordType: "user", recordId: user.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const totalPaid =
    user.bills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.totalAgorot, 0) +
    user.donations.filter((d) => d.status === "PAID").reduce((s, d) => s + d.amountAgorot, 0) +
    user.memberships.reduce((s, m) => s + m.transactions.reduce((ts, t) => ts + t.amountAgorot, 0), 0) +
    user.paymentLinks.filter((l) => l.status === "PAID").reduce((s, l) => s + l.amountAgorot, 0) +
    user.externalTransactions.reduce((s, t) => s + t.amountAgorot, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{user.fullName}</h1>
          <p className="mt-1 text-sm text-ink/60">Combined record — total paid {formatAgorotAsILS(totalPaid)}</p>
        </div>
        <Link href="/admin/users" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale">
          Back to Users
        </Link>
      </div>

      <div className="mt-6">
        <EditUserForm
          userId={user.id}
          initial={{
            fullName: user.fullName,
            email: user.email ?? "",
            phone: user.phone ?? "",
            address: user.address ?? "",
            city: user.city ?? "",
            notes: user.notes ?? "",
          }}
        />
      </div>

      {user.bills.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Holiday Seats ({user.bills.length})</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Holidays</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {user.bills.map((b) => (
                  <tr key={b.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{b.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{b.lineItems.map((li) => li.holiday.nameEn).join(", ") || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(b.totalAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{b.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromUserAction}>
                        <input type="hidden" name="kind" value="bill" />
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from user</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {user.donations.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Donations ({user.donations.length})</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {user.donations.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{d.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{d.purpose || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(d.amountAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{d.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromUserAction}>
                        <input type="hidden" name="kind" value="donation" />
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from user</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {user.memberships.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Memberships ({user.memberships.length})</h2>
          {user.memberships.map((m) => (
            <div key={m.id} className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-pale px-4 py-3">
                <p className="text-sm text-ink/70">
                  {m.tier === "FULL" ? "Full" : "Associate"} · {formatAgorotAsILS(m.monthlyAgorot)}/mo · {m.status.replace("_", " ")}
                </p>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/memberships/${m.id}`} className="text-xs font-medium text-ink hover:underline">
                    Full History →
                  </Link>
                  <form action={unlinkFromUserAction}>
                    <input type="hidden" name="kind" value="membership" />
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove</button>
                  </form>
                </div>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-xs font-semibold uppercase tracking-wide text-ink/50">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Confirmation</th>
                  </tr>
                </thead>
                <tbody>
                  {m.transactions.slice(0, 5).map((t) => (
                    <tr key={t.id} className="border-t border-line">
                      <td className="px-4 py-2 text-ink/70">{t.receivedAt.toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-ink/70">{formatAgorotAsILS(t.amountAgorot)}</td>
                      <td className="px-4 py-2 font-mono text-xs text-ink/50">{t.confirmation || "—"}</td>
                    </tr>
                  ))}
                  {m.transactions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-center text-ink/40">No charges yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {user.paymentLinks.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Payment Links ({user.paymentLinks.length})</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {user.paymentLinks.map((l) => (
                  <tr key={l.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{l.label}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(l.amountAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{l.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromUserAction}>
                        <input type="hidden" name="kind" value="paymentLink" />
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from user</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {user.formResponses.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Form Submissions ({user.formResponses.length})</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Form</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {user.formResponses.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{r.form.title}</td>
                    <td className="px-4 py-3 text-ink/70">{r.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/forms/${r.formId}/responses/${r.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                        View / Edit
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromUserAction}>
                        <input type="hidden" name="kind" value="formResponse" />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from user</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {user.externalTransactions.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Other Transactions ({user.externalTransactions.length})</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {user.externalTransactions.map((t) => (
                  <tr key={t.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{t.receivedAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{t.groupe || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(t.amountAgorot)}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromUserAction}>
                        <input type="hidden" name="kind" value="externalTransaction" />
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="userId" value={user.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from user</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {user.bills.length === 0 &&
        user.donations.length === 0 &&
        user.memberships.length === 0 &&
        user.paymentLinks.length === 0 &&
        user.formResponses.length === 0 &&
        user.externalTransactions.length === 0 && (
          <p className="mt-8 text-ink/50">Nothing linked to this user yet.</p>
        )}

      <AuditHistory entries={auditEntries} />
    </div>
  );
}

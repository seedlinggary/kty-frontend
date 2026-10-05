import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { EditPersonForm } from "@/components/admin/edit-person-form";
import { unlinkFromPersonAction } from "@/lib/actions/people";

export const metadata: Metadata = { title: "Person" };

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await prisma.person.findUnique({
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
  if (!person) notFound();

  const totalPaid =
    person.bills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.totalAgorot, 0) +
    person.donations.filter((d) => d.status === "PAID").reduce((s, d) => s + d.amountAgorot, 0) +
    person.memberships.reduce((s, m) => s + m.transactions.reduce((ts, t) => ts + t.amountAgorot, 0), 0) +
    person.paymentLinks.filter((l) => l.status === "PAID").reduce((s, l) => s + l.amountAgorot, 0) +
    person.externalTransactions.reduce((s, t) => s + t.amountAgorot, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{person.fullName}</h1>
          <p className="mt-1 text-sm text-ink/60">Combined record — total paid {formatAgorotAsILS(totalPaid)}</p>
        </div>
        <Link href="/admin/people" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale">
          Back to People
        </Link>
      </div>

      <div className="mt-6">
        <EditPersonForm
          personId={person.id}
          initial={{
            fullName: person.fullName,
            email: person.email ?? "",
            phone: person.phone ?? "",
            address: person.address ?? "",
            city: person.city ?? "",
            notes: person.notes ?? "",
          }}
        />
      </div>

      {person.bills.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Holiday Seats ({person.bills.length})</h2>
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
                {person.bills.map((b) => (
                  <tr key={b.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{b.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{b.lineItems.map((li) => li.holiday.nameEn).join(", ") || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(b.totalAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{b.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromPersonAction}>
                        <input type="hidden" name="kind" value="bill" />
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="personId" value={person.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from person</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {person.donations.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Donations ({person.donations.length})</h2>
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
                {person.donations.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{d.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{d.purpose || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(d.amountAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{d.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromPersonAction}>
                        <input type="hidden" name="kind" value="donation" />
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="personId" value={person.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from person</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {person.memberships.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Memberships ({person.memberships.length})</h2>
          {person.memberships.map((m) => (
            <div key={m.id} className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-pale px-4 py-3">
                <p className="text-sm text-ink/70">
                  {m.tier === "FULL" ? "Full" : "Associate"} · {formatAgorotAsILS(m.monthlyAgorot)}/mo · {m.status.replace("_", " ")}
                </p>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/memberships/${m.id}`} className="text-xs font-medium text-ink hover:underline">
                    Full History →
                  </Link>
                  <form action={unlinkFromPersonAction}>
                    <input type="hidden" name="kind" value="membership" />
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="personId" value={person.id} />
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

      {person.paymentLinks.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Payment Links ({person.paymentLinks.length})</h2>
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
                {person.paymentLinks.map((l) => (
                  <tr key={l.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{l.label}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(l.amountAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{l.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromPersonAction}>
                        <input type="hidden" name="kind" value="paymentLink" />
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="personId" value={person.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from person</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {person.formResponses.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Form Submissions ({person.formResponses.length})</h2>
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
                {person.formResponses.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{r.form.title}</td>
                    <td className="px-4 py-3 text-ink/70">{r.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/forms/${r.formId}/responses/${r.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                        View / Edit
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromPersonAction}>
                        <input type="hidden" name="kind" value="formResponse" />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="personId" value={person.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from person</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {person.externalTransactions.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Other Transactions ({person.externalTransactions.length})</h2>
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
                {person.externalTransactions.map((t) => (
                  <tr key={t.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{t.receivedAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{t.groupe || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(t.amountAgorot)}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromPersonAction}>
                        <input type="hidden" name="kind" value="externalTransaction" />
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="personId" value={person.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from person</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {person.bills.length === 0 &&
        person.donations.length === 0 &&
        person.memberships.length === 0 &&
        person.paymentLinks.length === 0 &&
        person.formResponses.length === 0 &&
        person.externalTransactions.length === 0 && (
          <p className="mt-8 text-ink/50">Nothing linked to this person yet.</p>
        )}
    </div>
  );
}

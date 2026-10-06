import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { EditFamilyForm } from "@/components/admin/edit-family-form";
import { unlinkFromFamilyAction, type ItemKind } from "@/lib/actions/families";
import { AuditHistory } from "@/components/admin/audit-history";
import { QuickCombinePicker } from "@/components/admin/quick-combine-picker";

export const metadata: Metadata = { title: "Family" };

export default async function FamilyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const family = await prisma.family.findUnique({
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
  if (!family) notFound();

  const auditEntries = await prisma.adminAuditLog.findMany({
    where: { recordType: "family", recordId: family.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const totalPaid =
    family.bills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.totalAgorot, 0) +
    family.donations.filter((d) => d.status === "PAID").reduce((s, d) => s + d.amountAgorot, 0) +
    family.memberships.reduce((s, m) => s + m.transactions.reduce((ts, t) => ts + t.amountAgorot, 0), 0) +
    family.paymentLinks.filter((l) => l.status === "PAID").reduce((s, l) => s + l.amountAgorot, 0) +
    family.externalTransactions.reduce((s, t) => s + t.amountAgorot, 0);

  const activeMembership = family.memberships.find((m) => m.status === "ACTIVE");

  // Any one existing linked record to anchor "Add another record" to - the
  // merge action works by combining two known items, so adding a new one to
  // an existing family means merging it with something already here.
  const anchor: { kind: ItemKind; id: string } | null = family.bills[0]
    ? { kind: "bill", id: family.bills[0].id }
    : family.donations[0]
      ? { kind: "donation", id: family.donations[0].id }
      : family.memberships[0]
        ? { kind: "membership", id: family.memberships[0].id }
        : family.paymentLinks[0]
          ? { kind: "paymentLink", id: family.paymentLinks[0].id }
          : family.formResponses[0]
            ? { kind: "formResponse", id: family.formResponses[0].id }
            : family.externalTransactions[0]
              ? { kind: "externalTransaction", id: family.externalTransactions[0].id }
              : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">{family.fullName}</h1>
          <p className="mt-1 text-sm text-ink/60">Combined household record — total paid {formatAgorotAsILS(totalPaid)}</p>
          <p className="mt-2">
            {activeMembership ? (
              <Link
                href={`/admin/memberships/${activeMembership.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 hover:bg-green-200"
              >
                Active Membership · {activeMembership.tier === "FULL" ? "Full" : "Associate"}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                No Active Membership
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {anchor && <QuickCombinePicker kind={anchor.kind} id={anchor.id} label="Add another record to this family…" />}
          <Link href="/admin/families" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale">
            Back to Families
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <EditFamilyForm
          familyId={family.id}
          initial={{
            fullName: family.fullName,
            email: family.email ?? "",
            phone: family.phone ?? "",
            address: family.address ?? "",
            city: family.city ?? "",
            notes: family.notes ?? "",
          }}
        />
      </div>

      {family.bills.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Holiday Seats ({family.bills.length})</h2>
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
                {family.bills.map((b) => (
                  <tr key={b.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{b.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{b.lineItems.map((li) => li.holiday.nameEn).join(", ") || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(b.totalAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{b.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        {b.lineItems[0] && (
                          <Link href={`/admin/holidays/${b.lineItems[0].holidayId}/signups`} className="text-xs font-medium text-ink hover:underline">
                            View
                          </Link>
                        )}
                        <form action={unlinkFromFamilyAction}>
                          <input type="hidden" name="kind" value="bill" />
                          <input type="hidden" name="id" value={b.id} />
                          <input type="hidden" name="familyId" value={family.id} />
                          <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from family</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {family.memberships.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Memberships ({family.memberships.length})</h2>
          {family.memberships.map((m) => (
            <div key={m.id} className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-pale px-4 py-3">
                <p className="text-sm text-ink/70">
                  {m.tier === "FULL" ? "Full" : "Associate"} · {formatAgorotAsILS(m.monthlyAgorot)}/mo · {m.status.replace("_", " ")}
                </p>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/memberships/${m.id}`} className="text-xs font-medium text-ink hover:underline">
                    Full History →
                  </Link>
                  <form action={unlinkFromFamilyAction}>
                    <input type="hidden" name="kind" value="membership" />
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="familyId" value={family.id} />
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

      {family.donations.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Donations ({family.donations.length})</h2>
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
                {family.donations.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{d.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{d.purpose || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(d.amountAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{d.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromFamilyAction}>
                        <input type="hidden" name="kind" value="donation" />
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="familyId" value={family.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from family</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {family.paymentLinks.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Payment Links ({family.paymentLinks.length})</h2>
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
                {family.paymentLinks.map((l) => (
                  <tr key={l.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{l.label}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(l.amountAgorot)}</td>
                    <td className="px-4 py-3 text-ink/70">{l.status}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromFamilyAction}>
                        <input type="hidden" name="kind" value="paymentLink" />
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="familyId" value={family.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from family</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {family.formResponses.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Form Submissions ({family.formResponses.length})</h2>
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
                {family.formResponses.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-medium text-ink">{r.form.title}</td>
                    <td className="px-4 py-3 text-ink/70">{r.createdAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/forms/${r.formId}/responses/${r.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                        View / Edit
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromFamilyAction}>
                        <input type="hidden" name="kind" value="formResponse" />
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="familyId" value={family.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from family</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {family.externalTransactions.length > 0 && (
        <>
          <h2 className="mt-8 font-serif text-lg font-semibold text-ink">Other Transactions ({family.externalTransactions.length})</h2>
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
                {family.externalTransactions.map((t) => (
                  <tr key={t.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 text-ink/70">{t.receivedAt.toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-ink/70">{t.groupe || "—"}</td>
                    <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(t.amountAgorot)}</td>
                    <td className="px-4 py-3">
                      <form action={unlinkFromFamilyAction}>
                        <input type="hidden" name="kind" value="externalTransaction" />
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="familyId" value={family.id} />
                        <button type="submit" className="text-xs font-medium text-ink/50 hover:underline">Remove from family</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {family.bills.length === 0 &&
        family.donations.length === 0 &&
        family.memberships.length === 0 &&
        family.paymentLinks.length === 0 &&
        family.formResponses.length === 0 &&
        family.externalTransactions.length === 0 && (
          <p className="mt-8 text-ink/50">Nothing linked to this family yet.</p>
        )}

      <AuditHistory entries={auditEntries} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { searchEverything } from "@/lib/global-search";
import { formatAgorotAsILS } from "@/lib/money";

import { FamilyBadge, MergeForm } from "@/components/admin/family-merge-ui";
import { QuickCombinePicker } from "@/components/admin/quick-combine-picker";
import { EstimatedMark } from "@/components/admin/estimated-mark";

const AMOUNT_ESTIMATED_NOTE =
  "NedarimPlus didn't report an amount for this specific charge, so this is our own fallback - this membership's regular monthly rate - not a figure NedarimPlus actually sent us.";
const TIER_ESTIMATED_NOTE =
  'Imported from NedarimPlus, which has no concept of "tier" - we guessed this by comparing the charge amount to our own Associate/Full price points.';
const RATE_ESTIMATED_NOTE =
  "NedarimPlus's standing-order listing didn't report a usable amount for this membership when it was imported - this is a placeholder, not a confirmed rate.";

export const metadata: Metadata = { title: "Search" };

function SectionHeading({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <h2 className="mt-8 font-serif text-lg font-semibold text-ink">
      {children} <span className="text-sm font-normal text-ink/50">({count})</span>
    </h2>
  );
}

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const results = q ? await searchEverything(q) : null;

  const totalResults = results
    ? results.bills.length +
      results.donations.length +
      results.memberships.length +
      results.paymentLinks.length +
      results.externalTransactions.length +
      results.untrackedFollowUps.length +
      results.formResponses.length
    : 0;

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Search</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/60">
        Search by name, email, or phone number across holiday seats, donations, memberships,
        payment links, other NedarimPlus transactions, and every congregant form submission - one
        box for everything about a person.
      </p>

      <form method="get" className="mt-6 flex items-end gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name, email, or phone number"
          autoFocus
          className="w-80 rounded-md border border-line px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent">
          Search
        </button>
      </form>

      {!q && <p className="mt-10 text-ink/50">Enter a search above to get started.</p>}


      {q && results && (
        <>
          <p className="mt-6 text-sm text-ink/60">
            {totalResults} result{totalResults === 1 ? "" : "s"} for &quot;{q}&quot;
          </p>

          <MergeForm>
            <p className="mt-2 text-xs text-ink/50">
              Check the rows below that are the same household - even if the name is spelled
              differently or a different email was used (across Holiday Seats, Donations,
              Memberships, Payment Links, and Form Submissions) - then combine them into one.
            </p>
            <button
              type="submit"
              className="mt-2 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
            >
              Combine Checked Rows Into One Family
            </button>

          {results.bills.length > 0 && (
            <>
              <SectionHeading count={results.bills.length}>Holiday Seats</SectionHeading>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                    <tr>
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Holidays</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.bills.map((b) => (
                      <tr key={b.id} className="border-t border-line align-top">
                        <td className="px-4 py-3">
                          <input type="checkbox" name="items" value={`bill:${b.id}`} className="h-4 w-4 rounded border-line" />
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {b.fullName}
                          <div><FamilyBadge family={b.family} /></div>
                        </td>
                        <td className="px-4 py-3 text-ink/70">
                          <p>{b.phone}</p>
                          {b.email && <p className="text-xs text-ink/50">{b.email}</p>}
                        </td>
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
                            <QuickCombinePicker kind="bill" id={b.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {results.donations.length > 0 && (
            <>
              <SectionHeading count={results.donations.length}>Donations</SectionHeading>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                    <tr>
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Purpose</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.donations.map((d) => (
                      <tr key={d.id} className="border-t border-line align-top">
                        <td className="px-4 py-3">
                          <input type="checkbox" name="items" value={`donation:${d.id}`} className="h-4 w-4 rounded border-line" />
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {d.fullName}
                          <div><FamilyBadge family={d.family} /></div>
                        </td>
                        <td className="px-4 py-3 text-ink/70">
                          <p>{d.email}</p>
                          {d.phone && <p className="text-xs text-ink/50">{d.phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-ink/70">{d.purpose || "—"}</td>
                        <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(d.amountAgorot)}</td>
                        <td className="px-4 py-3 text-ink/70">{d.status}</td>
                        <td className="px-4 py-3 font-mono text-xs text-ink/60">DON-{d.referenceCode}</td>
                        <td className="px-4 py-3">
                          <QuickCombinePicker kind="donation" id={d.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/admin/donations" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                Manage all donations →
              </Link>
            </>
          )}

          {results.memberships.length > 0 && (
            <>
              <SectionHeading count={results.memberships.length}>Memberships</SectionHeading>
              {results.memberships.map((m) => (
                <div key={m.id} className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-pale px-4 py-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" name="items" value={`membership:${m.id}`} className="mt-1 h-4 w-4 rounded border-line" />
                      <div>
                        <p className="font-medium text-ink">{m.fullName}</p>
                        <p className="text-xs text-ink/60">
                          {m.email} {m.phone && `· ${m.phone}`} · {m.tier === "FULL" ? "Full" : "Associate"}
                          {m.createdBy === "nedarim-import" && <EstimatedMark title={TIER_ESTIMATED_NOTE} />} ·{" "}
                          {formatAgorotAsILS(m.monthlyAgorot)}/mo
                          {m.monthlyAgorotIsEstimated && <EstimatedMark title={RATE_ESTIMATED_NOTE} />} · {m.status.replace("_", " ")}
                        </p>
                        <FamilyBadge family={m.family} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Link href={`/admin/memberships/${m.id}`} className="text-xs font-medium text-ink hover:underline">
                        Full Payment History →
                      </Link>
                      <QuickCombinePicker kind="membership" id={m.id} />
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
                          <td className="px-4 py-2 text-ink/70">
                            {formatAgorotAsILS(t.amountAgorot)}
                            {t.amountIsEstimated && <EstimatedMark title={AMOUNT_ESTIMATED_NOTE} />}
                          </td>
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

          {results.paymentLinks.length > 0 && (
            <>
              <SectionHeading count={results.paymentLinks.length}>Payment Links</SectionHeading>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                    <tr>
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Label</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.paymentLinks.map((l) => (
                      <tr key={l.id} className="border-t border-line align-top">
                        <td className="px-4 py-3">
                          <input type="checkbox" name="items" value={`paymentLink:${l.id}`} className="h-4 w-4 rounded border-line" />
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {l.label}
                          <div><FamilyBadge family={l.family} /></div>
                        </td>
                        <td className="px-4 py-3 text-ink/70">
                          {l.fullName && <p>{l.fullName}</p>}
                          {l.email && <p className="text-xs text-ink/50">{l.email}</p>}
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(l.amountAgorot)}</td>
                        <td className="px-4 py-3 text-ink/70">{l.status}</td>
                        <td className="px-4 py-3">
                          <QuickCombinePicker kind="paymentLink" id={l.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/admin/payment-links" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                Manage all payment links →
              </Link>
            </>
          )}

          {results.formResponses.length > 0 && (
            <>
              <SectionHeading count={results.formResponses.length}>Form Submissions</SectionHeading>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                    <tr>
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Form</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.formResponses.map((r) => (
                      <tr key={r.id} className="border-t border-line align-top">
                        <td className="px-4 py-3">
                          <input type="checkbox" name="items" value={`formResponse:${r.id}`} className="h-4 w-4 rounded border-line" />
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {r.title}
                          <div><FamilyBadge family={r.family} /></div>
                        </td>
                        <td className="px-4 py-3 text-ink/70">{new Date(r.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <Link href={`/admin/forms/${r.formId}/responses/${r.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                              View / Edit
                            </Link>
                            <QuickCombinePicker kind="formResponse" id={r.id} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {results.externalTransactions.length > 0 && (
            <>
              <SectionHeading count={results.externalTransactions.length}>Other NedarimPlus Transactions</SectionHeading>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                    <tr>
                      <th className="px-4 py-3" />
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {results.externalTransactions.map((t) => (
                      <tr key={t.id} className="border-t border-line align-top">
                        <td className="px-4 py-3">
                          <input type="checkbox" name="items" value={`externalTransaction:${t.id}`} className="h-4 w-4 rounded border-line" />
                        </td>
                        <td className="px-4 py-3 text-ink/70">{t.receivedAt.toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {t.clientName || "—"}
                          <div><FamilyBadge family={t.family} /></div>
                        </td>
                        <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(t.amountAgorot)}</td>
                        <td className="px-4 py-3 text-ink/70">{t.groupe || "—"}</td>
                        <td className="px-4 py-3">
                          <QuickCombinePicker kind="externalTransaction" id={t.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/admin/other-transactions" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                View all other transactions →
              </Link>
            </>
          )}

          <button
            type="submit"
            className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
          >
            Combine Checked Rows Into One Family
          </button>
          </MergeForm>

          {results.untrackedFollowUps.length > 0 && (
            <>
              <SectionHeading count={results.untrackedFollowUps.length}>Untracked Payment Issues</SectionHeading>
              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.untrackedFollowUps.map((f) => (
                      <tr key={f.id} className="border-t border-line align-top">
                        <td className="px-4 py-3 font-medium text-ink">{f.externalFullName || "—"}</td>
                        <td className="px-4 py-3 text-ink/70">
                          {f.externalEmail && <p>{f.externalEmail}</p>}
                          {f.externalPhone && <p className="text-xs text-ink/50">{f.externalPhone}</p>}
                        </td>
                        <td className="px-4 py-3 text-ink/70">{f.externalAmountAgorot ? formatAgorotAsILS(f.externalAmountAgorot) : "—"}</td>
                        <td className="px-4 py-3 text-ink/70">{f.failureReason || "—"}</td>
                        <td className="px-4 py-3 text-ink/70">{f.status.replace("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/admin/payment-follow-ups" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
                Manage all follow-ups →
              </Link>
            </>
          )}

          {totalResults === 0 && <p className="mt-10 text-ink/50">No matches anywhere for &quot;{q}&quot;.</p>}
        </>
      )}
    </div>
  );
}

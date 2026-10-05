import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { formatAdminDate } from "@/lib/admin-dates";
import { isEmailConfigured } from "@/lib/email";
import { resolveFollowUpAction, dismissFollowUpAction } from "@/lib/actions/payment-follow-ups";
import { SendFollowUpButton, SendAllFollowUpsButton } from "@/components/admin/follow-up-actions";
import { ImportFailureEmailForm } from "@/components/admin/import-failure-email-form";
import { SortHeader } from "@/components/admin/sort-header";
import { buildSortHref, nextSortDir, type SortDir } from "@/lib/sort-params";
import type { Prisma } from "@/lib/generated/prisma/client";

export const metadata: Metadata = { title: "Payment Follow-Ups" };

const statusStyles: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  EMAIL_SENT: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-green-100 text-green-800",
  DISMISSED: "bg-gray-100 text-gray-500",
};

function describe(followUp: {
  bill: { fullName: string; totalAgorot: number; email: string | null } | null;
  donation: { fullName: string; amountAgorot: number; email: string | null } | null;
  membership: { fullName: string; monthlyAgorot: number; email: string | null } | null;
  paymentLink: { label: string; fullName: string | null; amountAgorot: number; email: string | null } | null;
  externalFullName: string | null;
  externalEmail: string | null;
  externalAmountAgorot: number | null;
  externalCategory: string | null;
}) {
  if (followUp.bill) return { type: "Holiday Seats", name: followUp.bill.fullName, amount: followUp.bill.totalAgorot, email: followUp.bill.email };
  if (followUp.donation) return { type: "Donation", name: followUp.donation.fullName, amount: followUp.donation.amountAgorot, email: followUp.donation.email };
  if (followUp.membership) return { type: "Membership", name: followUp.membership.fullName, amount: followUp.membership.monthlyAgorot, email: followUp.membership.email };
  if (followUp.paymentLink) return { type: "Payment Link", name: followUp.paymentLink.fullName || followUp.paymentLink.label, amount: followUp.paymentLink.amountAgorot, email: followUp.paymentLink.email };
  if (followUp.externalFullName || followUp.externalAmountAgorot) {
    return {
      type: `Not ours${followUp.externalCategory ? ` (${followUp.externalCategory})` : ""}`,
      name: followUp.externalFullName || "Unknown",
      amount: followUp.externalAmountAgorot ?? 0,
      email: followUp.externalEmail,
    };
  }
  return { type: "Unknown", name: "—", amount: 0, email: null };
}

const SORT_COLUMNS = ["flagged", "type", "name", "amount", "status", "emails"] as const;
type SortKey = (typeof SORT_COLUMNS)[number];

export default async function PaymentFollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status ?? "OPEN_AND_SENT";
  const q = sp.q?.trim().toLowerCase() ?? "";
  const sortKey: SortKey = SORT_COLUMNS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "flagged";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

  const where: Prisma.PaymentFollowUpWhereInput =
    statusFilter === "ALL"
      ? {}
      : statusFilter === "OPEN_AND_SENT"
        ? { status: { in: ["OPEN", "EMAIL_SENT"] } }
        : { status: statusFilter as "OPEN" | "EMAIL_SENT" | "RESOLVED" | "DISMISSED" };

  const fetched = await prisma.paymentFollowUp.findMany({
    where,
    include: {
      bill: { select: { fullName: true, totalAgorot: true, email: true } },
      donation: { select: { fullName: true, amountAgorot: true, email: true } },
      membership: { select: { fullName: true, monthlyAgorot: true, email: true } },
      paymentLink: { select: { label: true, fullName: true, amountAgorot: true, email: true } },
    },
  });
  // (externalFullName/externalEmail/externalAmountAgorot/externalCategory are
  // plain columns on PaymentFollowUp itself, already included by default.)

  let withInfo = fetched.map((f) => ({ f, info: describe(f) }));
  if (q) {
    withInfo = withInfo.filter(
      ({ info }) => info.name.toLowerCase().includes(q) || info.email?.toLowerCase().includes(q)
    );
  }

  const direction = dir === "asc" ? 1 : -1;
  withInfo.sort((a, b) => {
    switch (sortKey) {
      case "type":
        return direction * a.info.type.localeCompare(b.info.type);
      case "name":
        return direction * a.info.name.localeCompare(b.info.name);
      case "amount":
        return direction * (a.info.amount - b.info.amount);
      case "status":
        return direction * a.f.status.localeCompare(b.f.status);
      case "emails":
        return direction * (a.f.emailsSentCount - b.f.emailsSentCount);
      case "flagged":
      default:
        return direction * (a.f.createdAt.getTime() - b.f.createdAt.getTime());
    }
  });

  const openCount = fetched.filter((f) => f.status === "OPEN").length;
  const emailConfigured = isEmailConfigured();

  function sortHref(column: SortKey) {
    return buildSortHref("/admin/payment-follow-ups", sp, { sort: column, dir: nextSortDir(sortKey, dir, column) });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Payment Follow-Ups</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            NedarimPlus never tells us directly when a payment is declined - only when one
            succeeds. These are payments that stayed pending past the grace window with no
            success ever arriving (flagged automatically), or that staff flagged by hand after
            reading a forwarded decline email. If someone retries and it goes through, this
            resolves itself automatically - no need to track that by hand.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SendAllFollowUpsButton count={openCount} />
          <ImportFailureEmailForm />
        </div>
      </div>

      {!emailConfigured && (
        <p className="mt-4 rounded-md bg-amber-50 p-4 text-sm text-amber-900">
          Email sending isn&apos;t configured yet (SMTP_HOST/SMTP_USER/SMTP_PASSWORD env vars) -
          follow-ups below can still be tracked and resolved, but &quot;Send Email&quot; won&apos;t
          work until that&apos;s set up.
        </p>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Name or email"
            className="w-56 rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Status</label>
          <select name="status" defaultValue={statusFilter} className="rounded-md border border-line px-3 py-2 text-sm">
            <option value="OPEN_AND_SENT">Needs attention (open + already emailed)</option>
            <option value="OPEN">Open only</option>
            <option value="EMAIL_SENT">Emailed only</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <button type="submit" className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale">
          Apply
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
            <tr>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("type")} isActive={sortKey === "type"} dir={dir}>Type</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("name")} isActive={sortKey === "name"} dir={dir}>Name</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("amount")} isActive={sortKey === "amount"} dir={dir}>Amount</SortHeader>
              </th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("status")} isActive={sortKey === "status"} dir={dir}>Status</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("emails")} isActive={sortKey === "emails"} dir={dir}>Emails Sent</SortHeader>
              </th>
              <th className="px-4 py-3">
                <SortHeader href={sortHref("flagged")} isActive={sortKey === "flagged"} dir={dir}>Flagged</SortHeader>
              </th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {withInfo.map(({ f, info }) => (
              <tr key={f.id} className="border-t border-line align-top">
                <td className="px-4 py-3 text-ink/70">{info.type}</td>
                <td className="px-4 py-3 font-medium text-ink">{info.name}</td>
                <td className="px-4 py-3 text-ink/70">{formatAgorotAsILS(info.amount)}</td>
                <td className="px-4 py-3 text-ink/70">{info.email || <span className="text-ink/40">none</span>}</td>
                <td className="px-4 py-3 text-ink/70">
                  {f.reason === "STALE_PENDING"
                    ? "Stale pending"
                    : f.reason === "FAILURE_EMAIL"
                      ? "Failure email"
                      : f.reason === "API_DECLINE"
                        ? "Detected automatically (standing order check)"
                        : "Manual"}
                  {f.failureReason && <p className="mt-1 text-xs text-ink/50">{f.failureReason}{f.cardLast4 && ` (card •${f.cardLast4})`}</p>}
                  {f.notes && <p className="mt-1 text-xs text-ink/50">{f.notes}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[f.status]}`}>{f.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 text-ink/70">{f.emailsSentCount}</td>
                <td className="px-4 py-3 whitespace-nowrap text-ink/70">{formatAdminDate(f.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-2">
                    {f.status !== "RESOLVED" && f.status !== "DISMISSED" && (
                      <>
                        <SendFollowUpButton followUpId={f.id} />
                        <form action={resolveFollowUpAction}>
                          <input type="hidden" name="id" value={f.id} />
                          <button type="submit" className="text-xs font-medium text-ink hover:underline">Mark Resolved</button>
                        </form>
                        <form action={dismissFollowUpAction}>
                          <input type="hidden" name="id" value={f.id} />
                          <button type="submit" className="text-xs font-medium text-ink/60 hover:underline">Dismiss</button>
                        </form>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {withInfo.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink/50">Nothing here right now.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

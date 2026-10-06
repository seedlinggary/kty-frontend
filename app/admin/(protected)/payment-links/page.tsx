import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { CreatePaymentLinkForm } from "@/components/admin/create-payment-link-form";
import { buildPaymentLink } from "@/lib/nedarim";
import { markPaymentLinkPaidAction } from "@/lib/actions/payment-admin";
import { cancelPaymentLinkAction } from "@/lib/actions/payment-links";
import { flagForFollowUpAction } from "@/lib/actions/payment-follow-ups";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { MergeForm, MergeCheckbox, MergeErrorBanner, UserBadge } from "@/components/admin/user-merge-ui";
import { GroupByUserToggle } from "@/components/admin/group-by-user-toggle";
import { groupByUser } from "@/lib/user-grouping";
import type { BillStatus, Prisma } from "@/lib/generated/prisma/client";
import { DoubleConfirmSubmitButton } from "@/components/admin/double-confirm-submit-button";
import { SubmitButton } from "@/components/admin/submit-button";
import { SortHeader } from "@/components/admin/sort-header";
import { buildSortHref, nextSortDir, type SortDir } from "@/lib/sort-params";

export const metadata: Metadata = { title: "Payment Links" };

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

type PaymentLinkRow = Prisma.PaymentLinkGetPayload<{ include: { user: { select: { id: true; fullName: true } } } }>;

const SORT_COLUMNS = ["date", "label", "amount", "status"] as const;
type SortKey = (typeof SORT_COLUMNS)[number];

export default async function PaymentLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; view?: string; mergeError?: string; sort?: string; dir?: string }>;
}) {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPERADMIN";
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status ?? "ALL";
  const grouped = sp.view !== "raw";
  const sortKey: SortKey = SORT_COLUMNS.includes(sp.sort as SortKey) ? (sp.sort as SortKey) : "date";
  const dir: SortDir = sp.dir === "asc" ? "asc" : "desc";

  const where: Prisma.PaymentLinkWhereInput = {};
  if (statusFilter !== "ALL") where.status = statusFilter as BillStatus;
  if (q) {
    where.OR = [
      { label: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const fetched = await prisma.paymentLink.findMany({
    where,
    include: { user: { select: { id: true, fullName: true } } },
  });

  const direction = dir === "asc" ? 1 : -1;
  const links = [...fetched].sort((a, b) => {
    switch (sortKey) {
      case "label":
        return direction * a.label.localeCompare(b.label);
      case "amount":
        return direction * (a.amountAgorot - b.amountAgorot);
      case "status":
        return direction * a.status.localeCompare(b.status);
      case "date":
      default:
        return direction * (a.createdAt.getTime() - b.createdAt.getTime());
    }
  });

  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  if (statusFilter !== "ALL") redirectParams.set("status", statusFilter);
  const redirectQs = redirectParams.toString();
  const redirectTo = `/admin/payment-links${redirectQs ? `?${redirectQs}` : ""}`;

  const { groups, ungrouped } = groupByUser(links, (l) => l.user);

  function sortHref(column: SortKey) {
    return buildSortHref("/admin/payment-links", sp, { sort: column, dir: nextSortDir(sortKey, dir, column) });
  }

  function TableHead() {
    return (
      <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
        <tr>
          <th className="px-4 py-3" />
          <th className="px-4 py-3">
            <SortHeader href={sortHref("label")} isActive={sortKey === "label"} dir={dir}>Label</SortHeader>
          </th>
          <th className="px-4 py-3">Contact</th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("amount")} isActive={sortKey === "amount"} dir={dir}>Amount</SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader href={sortHref("status")} isActive={sortKey === "status"} dir={dir}>Status</SortHeader>
          </th>
          <th className="px-4 py-3">Reference</th>
          <th className="px-4 py-3">Actions</th>
        </tr>
      </thead>
    );
  }

  function Row({ link }: { link: PaymentLinkRow }) {
    const paymentLink =
      link.status === "PENDING"
        ? buildPaymentLink({
            billId: link.referenceCode,
            amountAgorot: link.amountAgorot,
            clientName: link.fullName || "Payment",
            phone: link.phone || "",
            email: link.email,
            groupe: link.label,
            referencePrefix: "LINK",
            redirectParam: "link",
          })
        : null;
    return (
      <tr key={link.id} className="border-t border-line align-top">
        <td className="px-4 py-3">
          <MergeCheckbox kind="paymentLink" id={link.id} />
        </td>
        <td className="px-4 py-3 font-medium text-ink">
          {link.label}
          <div>
            <UserBadge user={link.user} />
          </div>
        </td>
        <td className="px-4 py-3 text-ink/70">
          {link.fullName && <p>{link.fullName}</p>}
          {link.phone && <p className="text-xs text-ink/50">{link.phone}</p>}
        </td>
        <td className="px-4 py-3 font-medium text-ink">{formatAgorotAsILS(link.amountAgorot)}</td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[link.status]}`}>{link.status}</span>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-ink/60">LINK-{link.referenceCode}</td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-2">
            {paymentLink && <CopyLinkButton link={paymentLink} label="Copy Payment Link" />}
            {link.status === "PENDING" && (
              <form action={markPaymentLinkPaidAction}>
                <input type="hidden" name="id" value={link.id} />
                <SubmitButton className="rounded bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800">
                  Mark Paid
                </SubmitButton>
              </form>
            )}
            {link.status !== "CANCELLED" && isSuperAdmin && (
              <form action={cancelPaymentLinkAction}>
                <input type="hidden" name="id" value={link.id} />
                <DoubleConfirmSubmitButton
                  confirmMessage={`Cancel "${link.label}"? This only updates our own records.`}
                  typeToConfirm="CANCEL"
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Cancel
                </DoubleConfirmSubmitButton>
              </form>
            )}
            {link.status === "PENDING" && (
              <form action={flagForFollowUpAction}>
                <input type="hidden" name="kind" value="paymentLink" />
                <input type="hidden" name="id" value={link.id} />
                <SubmitButton className="text-xs font-medium text-amber-700 hover:underline">Flag Failed</SubmitButton>
              </form>
            )}
            {isSuperAdmin && (
              <Link href={`/admin/payment-links/${link.id}/edit`} className="text-xs font-medium text-ink hover:underline">
                Edit (Override)
              </Link>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Payment Links</h1>
          <p className="mt-1 text-sm text-ink/60">
            {links.length} shown · Fixed, predetermined-amount links - for a pledge, an event fee, or
            correcting an underpayment - so someone can just pay that exact amount. Creating one
            requires a super admin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <GroupByUserToggle />
          <a
            href="/admin/payment-links/export"
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
          >
            Export CSV
          </a>
        </div>
      </div>

      {isSuperAdmin ? (
        <div className="mt-6">
          <CreatePaymentLinkForm />
        </div>
      ) : (
        <p className="mt-6 rounded-md bg-pale p-4 text-sm text-ink/60">
          Only a super admin can create a new payment link. You can still view and manage existing
          ones below.
        </p>
      )}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Label, name, email, or phone"
            className="w-56 rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Status</label>
          <select name="status" defaultValue={statusFilter} className="rounded-md border border-line px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent">
          Apply
        </button>
      </form>

      <MergeErrorBanner show={sp.mergeError === "select-at-least-two"} />

      {links.length === 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <TableHead />
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink/50">No payment links yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <MergeForm redirectTo={redirectTo} />
          {grouped ? (
            <div className="mt-4 space-y-6">
              {groups.map(({ user, items }) => (
                <div key={user.id} className="overflow-hidden rounded-xl border border-line bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-pale px-4 py-3">
                    <Link href={`/admin/users/${user.id}`} className="font-medium text-ink hover:underline">
                      {user.fullName}
                    </Link>
                    <span className="text-xs text-ink/60">{items.length} link{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <TableHead />
                    <tbody>{items.map((link) => <Row key={link.id} link={link} />)}</tbody>
                  </table>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-ink/60">Not linked to a user ({ungrouped.length})</h2>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
                    <table className="w-full text-left text-sm">
                      <TableHead />
                      <tbody>{ungrouped.map((link) => <Row key={link.id} link={link} />)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <TableHead />
                <tbody>{links.map((link) => <Row key={link.id} link={link} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

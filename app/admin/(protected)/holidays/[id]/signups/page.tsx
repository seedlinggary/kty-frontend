import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAgorotAsILS } from "@/lib/money";
import { buildPaymentLink } from "@/lib/nedarim";
import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { DoubleConfirmSubmitButton } from "@/components/admin/double-confirm-submit-button";
import {
  markSignupPaidAction,
  cancelSignupAction,
  reopenSignupAction,
  deleteSignupLineItemAction,
} from "@/lib/actions/signup-admin";
import type { Prisma, BillStatus } from "@/lib/generated/prisma/client";
import { MergeForm, MergeCheckbox, MergeErrorBanner, UserBadge } from "@/components/admin/user-merge-ui";
import { GroupByUserToggle } from "@/components/admin/group-by-user-toggle";
import { groupByUser } from "@/lib/user-grouping";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const holiday = await prisma.holiday.findUnique({ where: { id } });
  return { title: holiday ? `Signups — ${holiday.nameEn}` : "Signups" };
}

const statusStyles: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

type SearchParams = {
  q?: string;
  status?: string;
  member?: string;
  sort?: string;
  dir?: string;
  view?: string;
  mergeError?: string;
};

const SORT_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "member", label: "Member" },
  { key: "seats", label: "Seats" },
  { key: "total", label: "Line Total" },
] as const;

function buildHref(id: string, params: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...params, ...overrides };
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) usp.set(key, value);
  }
  const qs = usp.toString();
  return `/admin/holidays/${id}/signups${qs ? `?${qs}` : ""}`;
}

export default async function HolidaySignupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const statusFilter = sp.status ?? "ALL";
  const memberFilter = sp.member ?? "ALL";
  const sortKey = SORT_COLUMNS.some((c) => c.key === sp.sort) ? sp.sort! : "date";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const grouped = sp.view !== "raw";

  const billWhere: Prisma.BillWhereInput = {};
  if (memberFilter === "MEMBER") billWhere.isMember = true;
  if (memberFilter === "NONMEMBER") billWhere.isMember = false;
  if (statusFilter !== "ALL") billWhere.status = statusFilter as BillStatus;
  if (q) {
    billWhere.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const holiday = await prisma.holiday.findUnique({
    where: { id },
    include: {
      signups: {
        where: { deletedAt: null, bill: billWhere },
        include: {
          bill: {
            include: {
              transactions: true,
              lineItems: { where: { deletedAt: null }, include: { holiday: true } },
              user: { select: { id: true, fullName: true } },
            },
          },
        },
      },
    },
  });
  if (!holiday) notFound();

  const direction = dir === "asc" ? 1 : -1;
  const signups = [...holiday.signups].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return direction * a.bill.fullName.localeCompare(b.bill.fullName);
      case "status":
        return direction * a.bill.status.localeCompare(b.bill.status);
      case "member":
        return direction * (Number(a.bill.isMember) - Number(b.bill.isMember));
      case "seats":
        return direction * (a.menSeats + a.womenSeats - (b.menSeats + b.womenSeats));
      case "total":
        return direction * (a.totalAgorot - b.totalAgorot);
      case "date":
      default:
        return direction * (a.createdAt.getTime() - b.createdAt.getTime());
    }
  });

  const isFiltered = Boolean(q) || statusFilter !== "ALL" || memberFilter !== "ALL";

  const redirectParams = new URLSearchParams();
  if (q) redirectParams.set("q", q);
  if (statusFilter !== "ALL") redirectParams.set("status", statusFilter);
  if (memberFilter !== "ALL") redirectParams.set("member", memberFilter);
  const redirectQs = redirectParams.toString();
  const redirectTo = `/admin/holidays/${holiday.id}/signups${redirectQs ? `?${redirectQs}` : ""}`;

  const { groups, ungrouped } = groupByUser(signups, (s) => s.bill.user);

  function TableHead() {
    return (
      <thead className="bg-pale text-xs font-semibold uppercase tracking-wide text-ink/60">
        <tr>
          <th className="px-4 py-3" />
          <th className="px-4 py-3">
            <SortHeader id={holiday!.id} sp={sp} sortKey="name" currentSort={sortKey} currentDir={dir}>
              Name
            </SortHeader>
          </th>
          <th className="px-4 py-3">Contact</th>
          <th className="px-4 py-3">
            <SortHeader id={holiday!.id} sp={sp} sortKey="member" currentSort={sortKey} currentDir={dir}>
              Member
            </SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader id={holiday!.id} sp={sp} sortKey="seats" currentSort={sortKey} currentDir={dir}>
              Seats (M/W)
            </SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader id={holiday!.id} sp={sp} sortKey="total" currentSort={sortKey} currentDir={dir}>
              Line Total
            </SortHeader>
          </th>
          <th className="px-4 py-3">
            <SortHeader id={holiday!.id} sp={sp} sortKey="status" currentSort={sortKey} currentDir={dir}>
              Status
            </SortHeader>
          </th>
          <th className="px-4 py-3">Bill</th>
          <th className="px-4 py-3">Actions</th>
        </tr>
      </thead>
    );
  }

  function Row({ s }: { s: (typeof signups)[number] }) {
    const bill = s.bill;
    const otherHolidays = bill.lineItems
      .filter((item) => item.holidayId !== holiday!.id)
      .map((item) => item.holiday.nameEn);

    const paymentLink =
      bill.status === "PENDING"
        ? buildPaymentLink({
            billId: bill.referenceCode,
            amountAgorot: bill.totalAgorot,
            clientName: bill.fullName,
            phone: bill.phone,
            email: bill.email,
            groupe: bill.lineItems.map((item) => item.holiday.nameEn).join(" + "),
          })
        : null;
    const lastTransaction = bill.transactions[bill.transactions.length - 1];

    return (
      <tr key={s.id} className="border-t border-line align-top">
        <td className="px-4 py-3">
          <MergeCheckbox kind="bill" id={bill.id} />
        </td>
        <td className="px-4 py-3 font-medium text-ink">
          {bill.fullName}
          <div>
            <UserBadge user={bill.user} />
          </div>
          {bill.notes && (
            <p className="mt-1 text-xs font-normal text-ink/50">{bill.notes}</p>
          )}
          {otherHolidays.length > 0 && (
            <p className="mt-1 text-xs font-normal text-accent">
              Also includes: {otherHolidays.join(", ")}
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-ink/70">
          <p>{bill.phone}</p>
          {bill.email && <p className="text-xs text-ink/50">{bill.email}</p>}
        </td>
        <td className="px-4 py-3 text-ink/70">{bill.isMember ? "Member" : "Non-member"}</td>
        <td className="px-4 py-3 text-ink/70">
          {s.menSeats} / {s.womenSeats}
        </td>
        <td className="px-4 py-3 font-medium text-ink">
          {formatAgorotAsILS(s.totalAgorot)}
          {otherHolidays.length > 0 && (
            <p className="text-xs font-normal text-ink/50">
              Bill total: {formatAgorotAsILS(bill.totalAgorot)}
            </p>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[bill.status]}`}
          >
            {bill.status}
          </span>
          {bill.status === "PAID" && lastTransaction?.confirmation && (
            <p className="mt-1 text-xs text-ink/50">Conf: {lastTransaction.confirmation}</p>
          )}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-ink/60">
          BILL-{bill.referenceCode}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-2">
            <Link
              href={`/admin/holidays/${holiday!.id}/signups/${s.id}/edit`}
              className="text-xs font-medium text-ink hover:underline"
            >
              Edit
            </Link>
            {paymentLink && <CopyLinkButton link={paymentLink} />}
            {bill.status === "PENDING" && (
              <form action={markSignupPaidAction} className="flex items-center gap-1">
                <input type="hidden" name="billId" value={bill.id} />
                <input
                  type="text"
                  name="confirmation"
                  placeholder="Conf #"
                  className="w-20 rounded border border-line px-1.5 py-1 text-xs"
                />
                <button
                  type="submit"
                  className="rounded bg-green-700 px-2 py-1 text-xs font-semibold text-white hover:bg-green-800"
                >
                  Mark Paid
                </button>
              </form>
            )}
            {bill.status !== "CANCELLED" && (
              <form action={cancelSignupAction}>
                <input type="hidden" name="billId" value={bill.id} />
                <DoubleConfirmSubmitButton
                  confirmMessage={`Cancel ${bill.fullName}'s bill? This only updates our own records.`}
                  typeToConfirm="CANCEL"
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Cancel
                </DoubleConfirmSubmitButton>
              </form>
            )}
            {bill.status === "CANCELLED" && (
              <form action={reopenSignupAction}>
                <input type="hidden" name="billId" value={bill.id} />
                <button type="submit" className="text-xs font-medium text-ink hover:underline">
                  Reopen
                </button>
              </form>
            )}
            <form action={deleteSignupLineItemAction}>
              <input type="hidden" name="signupId" value={s.id} />
              <ConfirmSubmitButton
                confirmMessage={`Delete ${bill.fullName}'s ${holiday!.nameEn} entry? This removes it from totals and CSV exports. It can be restored from the database if needed, but there's no undo button.`}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Delete
              </ConfirmSubmitButton>
            </form>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">
            Signups — {holiday.nameEn}
          </h1>
          <p className="text-sm text-ink/50">
            {signups.length} shown{isFiltered ? " (filtered)" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <GroupByUserToggle />
          <a
            href={`/admin/holidays/${holiday.id}/signups/export`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
          >
            Export CSV
          </a>
          <Link
            href={`/admin/holidays/${holiday.id}/signups/new`}
            className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
          >
            + Create Bill
          </Link>
          <Link
            href={`/admin/holidays/${holiday.id}`}
            className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
          >
            Back to Holiday
          </Link>
        </div>
      </div>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4"
      >
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Name, email, or phone"
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
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">Membership</label>
          <select name="member" defaultValue={memberFilter} className="rounded-md border border-line px-3 py-2 text-sm">
            <option value="ALL">All</option>
            <option value="MEMBER">Members only</option>
            <option value="NONMEMBER">Non-members only</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          Apply
        </button>
        {isFiltered && (
          <Link
            href={`/admin/holidays/${holiday.id}/signups`}
            className="text-sm font-medium text-ink/60 hover:text-ink hover:underline"
          >
            Clear filters
          </Link>
        )}
      </form>

      <MergeErrorBanner show={sp.mergeError === "select-at-least-two"} />

      {signups.length === 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            {TableHead()}
            <tbody>
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ink/50">
                  {isFiltered ? "No signups match these filters." : "No signups yet."}
                </td>
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
                    <span className="text-xs text-ink/60">{items.length} signup{items.length === 1 ? "" : "s"}</span>
                  </div>
                  <table className="w-full text-left text-sm">
                    {TableHead()}
                    <tbody>{items.map((s) => <Row key={s.id} s={s} />)}</tbody>
                  </table>
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-ink/60">Not linked to a user ({ungrouped.length})</h2>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-white">
                    <table className="w-full text-left text-sm">
                      {TableHead()}
                      <tbody>{ungrouped.map((s) => <Row key={s.id} s={s} />)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                {TableHead()}
                <tbody>{signups.map((s) => <Row key={s.id} s={s} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SortHeader({
  id,
  sp,
  sortKey,
  currentSort,
  currentDir,
  children,
}: {
  id: string;
  sp: SearchParams;
  sortKey: string;
  currentSort: string;
  currentDir: string;
  children: React.ReactNode;
}) {
  const isActive = currentSort === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  const href = buildHref(id, sp, { sort: sortKey, dir: nextDir });

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 hover:text-ink ${isActive ? "text-ink" : ""}`}
    >
      {children}
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={`h-3 w-3 shrink-0 ${isActive ? "text-accent" : "text-ink/30"}`}
      >
        {isActive ? (
          currentDir === "asc" ? (
            <path d="M6 3l4 5H2z" fill="currentColor" />
          ) : (
            <path d="M6 9L2 4h8z" fill="currentColor" />
          )
        ) : (
          <>
            <path d="M6 2l3 3.5H3z" fill="currentColor" />
            <path d="M6 10l3-3.5H3z" fill="currentColor" />
          </>
        )}
      </svg>
    </Link>
  );
}

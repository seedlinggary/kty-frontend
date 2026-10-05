"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  fetchKevaList,
  fetchKevaDetail,
  isNedarimReportingConfigured,
  type KevaListEntry,
} from "@/lib/nedarim-reports";
import { shekelsToAgorot } from "@/lib/money";
import { generateBillId } from "@/lib/billid";
import { MEMBERSHIP_PRICES_AGOROT } from "@/lib/memberships";
import type { MembershipTier, MembershipStatus } from "@/lib/generated/prisma/client";

export type ImportNedarimMembersResult =
  | { ok: true; imported: number; skipped: number; paymentsImported: number }
  | { ok: false; error: string };

/**
 * NedarimPlus's JSON reports don't reliably return numeric fields as JSON
 * numbers - some (confirmed: KevaSuccess/KevaTashlumim) come back as
 * numeric strings instead (e.g. "12"), sometimes with thousands separators
 * (e.g. "1,200"). Every numeric field read from their API goes through this
 * rather than a raw strict-equality/property check or a bare Number(), since
 * `===`/`!==` don't coerce ("1" !== 1), and Number() rejects a comma outright
 * (returning NaN, not the intended value).
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
  return isNaN(n) ? null : n;
}

function inferTier(amountAgorot: number): MembershipTier {
  const associate = MEMBERSHIP_PRICES_AGOROT.ASSOCIATE;
  const full = MEMBERSHIP_PRICES_AGOROT.FULL;
  return Math.abs(amountAgorot - full) < Math.abs(amountAgorot - associate) ? "FULL" : "ASSOCIATE";
}

/**
 * ACTIVE/PAST_DUE/CANCELLED here is a snapshot read of whatever NedarimPlus
 * last reported for this standing order at import/re-sync time: Enabled=0
 * means NedarimPlus shows it as off, and a non-empty ErrorText means the
 * last charge attempt NedarimPlus tried for it was declined. Separately
 * from this, our own daily check (see /api/cron/detect-payment-failures)
 * also marks any ACTIVE membership PAST_DUE on its own if its nextChargeDate
 * passes with no new charge recorded - so PAST_DUE can show up either from
 * this import/re-sync or from that ongoing check, whichever notices first.
 */
function inferStatus(keva: KevaListEntry): MembershipStatus {
  if (toNumber(keva.Enabled) === 0) return "CANCELLED";
  if (keva.ErrorText) return "PAST_DUE";
  return "ACTIVE";
}

/**
 * NedarimPlus's date fields have shown up in more than one shape in
 * practice, so this tries each in turn rather than assuming one:
 *  - the classic ASP.NET AJAX wrapper "/Date(1700000000000)/" (their
 *    reporting backend is ASP.NET-based .aspx, where this is a very common
 *    serialization quirk for anything typed as a .NET DateTime)
 *  - "DD/MM/YYYY" or "DD/MM/YY" (confirmed in practice: GetKevaId's history
 *    dates use a 2-digit year), optionally with a trailing time portion -
 *    checked explicitly rather than left to JS's native parser, since a
 *    bare slash-separated string gets read as US-style MM/DD/YYYY, silently
 *    swapping day and month for any date where the day is 12 or under. A
 *    2-digit year is always read as 20YY - this system has no plausible
 *    transaction from the 1900s.
 *  - a raw epoch number/numeric string
 *  - ISO 8601, as a last resort via the native parser
 * Logs (not throws) when nothing matches, so a real format mismatch shows
 * up in the logs instead of silently becoming "now" or "blank" downstream.
 */
function parseNedarimDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "string") {
    const aspNet = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    if (aspNet) {
      const d = new Date(Number(aspNet[1]));
      if (!isNaN(d.getTime())) return d;
    }

    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
    if (slash) {
      const [, d, mo, yRaw] = slash;
      const year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
      const parsed = new Date(Date.UTC(year, Number(mo) - 1, Number(d)));
      if (!isNaN(parsed.getTime())) return parsed;
    }

    if (/^-?\d+$/.test(raw.trim())) {
      const d = new Date(Number(raw));
      if (!isNaN(d.getTime())) return d;
    }

    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) return iso;
  }

  if (typeof raw === "number") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }

  console.error("[nedarim-import] Unrecognized date format from NedarimPlus:", raw);
  return null;
}

/**
 * Pulls in a standing order's full charge history (GetKevaId) and creates a
 * Transaction for any successful charge (HistoryData ID 1) we don't already
 * have, matched by NedarimPlus's own TransactionId so this is safe to run
 * repeatedly without ever duplicating a charge - including for a membership
 * that already has some history from our own webhook, in case a webhook
 * delivery was ever missed. Also backfills nedarimPaymentsMade/Remaining and
 * lastChargeAt from the same call.
 *
 * Per-entry Amount isn't always present in practice even for a successful
 * charge (NedarimPlus's own docs only promise it's blank for a cancelled/
 * declined one) - when it's missing or unparseable, this falls back to the
 * standing order's own recurring amount rather than recording a clearly-
 * wrong ₪0. Also retroactively fixes any ₪0 a past run already left behind
 * from before this fallback existed, for exactly the same reason.
 */
async function syncMembershipHistory(
  membershipId: string,
  kevaId: string,
  fallbackAmountAgorot: number
): Promise<number> {
  const detail = await fetchKevaDetail(kevaId);
  if (!detail) return 0;

  const paymentsMade = toNumber(detail.KevaSuccess);
  const paymentsRemaining = toNumber(detail.KevaTashlumim);
  await prisma.membership.update({
    where: { id: membershipId },
    data: {
      nedarimPaymentsMade: paymentsMade ?? undefined,
      nedarimPaymentsRemaining: paymentsRemaining ?? undefined,
    },
  });

  const history = detail.HistoryData ?? [];
  let imported = 0;
  let latestChargeAt: Date | null = null;

  for (const entry of history) {
    if (toNumber(entry.ID) !== 1 || !entry.TransactionId) continue;

    const amount = toNumber(entry.Amount);
    const amountAgorot = amount != null && amount > 0 ? shekelsToAgorot(amount) : fallbackAmountAgorot;
    const receivedAt = parseNedarimDate(entry.Date) ?? new Date();

    const existing = await prisma.transaction.findFirst({
      where: { membershipId, nedarimTransactionId: entry.TransactionId },
    });
    if (existing) {
      const fixes: { amountAgorot?: number; receivedAt?: Date } = {};
      if (existing.amountAgorot === 0 && amountAgorot > 0) fixes.amountAgorot = amountAgorot;
      // Only ever correct a date we imported ourselves, and only when the
      // newly-parsed value is meaningfully different - never touches a
      // webhook-sourced transaction's own recorded time.
      if (
        existing.source === "nedarim-import" &&
        Math.abs(receivedAt.getTime() - existing.receivedAt.getTime()) > 60_000
      ) {
        fixes.receivedAt = receivedAt;
      }
      if (Object.keys(fixes).length > 0) {
        await prisma.transaction.update({ where: { id: existing.id }, data: fixes });
      }
      if (!latestChargeAt || receivedAt > latestChargeAt) latestChargeAt = receivedAt;
      continue;
    }

    await prisma.transaction.create({
      data: {
        membershipId,
        nedarimTransactionId: entry.TransactionId,
        amountAgorot,
        source: "nedarim-import",
        receivedAt,
      },
    });
    imported++;
    if (!latestChargeAt || receivedAt > latestChargeAt) latestChargeAt = receivedAt;
  }

  if (latestChargeAt) {
    const current = await prisma.membership.findUnique({ where: { id: membershipId }, select: { lastChargeAt: true } });
    if (!current?.lastChargeAt || latestChargeAt > current.lastChargeAt) {
      await prisma.membership.update({ where: { id: membershipId }, data: { lastChargeAt: latestChargeAt } });
    }
  }

  return imported;
}

/**
 * Pulls in every standing order NedarimPlus already has on file - including
 * ones set up directly on NedarimPlus's own site before this system existed
 * - and creates a Membership here for any whose KevaId we don't already
 * have, then syncs its full charge history either way. Strictly read-only
 * against NedarimPlus: GetKevaJson/GetKevaId are both GET reports, nothing
 * here ever writes back to NedarimPlus or touches an existing standing
 * order. Safe to run repeatedly - a Membership already on file (matched by
 * KevaId) is never duplicated, and history is matched by NedarimPlus's own
 * TransactionId, so re-running only ever fills in what's still missing.
 */
export async function importNedarimMembersAction(): Promise<ImportNedarimMembersResult> {
  if (!isNedarimReportingConfigured()) {
    return { ok: false, error: "NedarimPlus reporting isn't configured (missing NEDARIM_APIPASSWORD)." };
  }

  const kevaList = await fetchKevaList();
  if (!kevaList) {
    return { ok: false, error: "Couldn't reach NedarimPlus's reporting API just now - try again shortly." };
  }

  let imported = 0;
  let skipped = 0;
  let paymentsImported = 0;

  for (const keva of kevaList) {
    if (!keva.KevaId) continue;

    let membership = await prisma.membership.findUnique({ where: { kevaId: keva.KevaId } });

    if (membership) {
      skipped++;
      // Signup date and next-charge date have no admin-editable UI anywhere
      // (nextChargeDate is otherwise only ever set by the webhook itself),
      // so both are always safe to correct from NedarimPlus's own report -
      // fixes anything imported before date parsing was correct. Never
      // touches status/tier/amount here: those can be deliberately changed
      // by staff (Cancel/Reactivate/Edit), so a re-sync leaves them alone.
      if (membership.createdBy === "nedarim-import") {
        const creationDate = parseNedarimDate(keva.CreationDate);
        const nextChargeDate = parseNedarimDate(keva.NextDate);
        const fixes: { createdAt?: Date; nextChargeDate?: Date } = {};
        if (creationDate && creationDate.getTime() !== membership.createdAt.getTime()) {
          fixes.createdAt = creationDate;
        }
        if (nextChargeDate && nextChargeDate.getTime() !== membership.nextChargeDate?.getTime()) {
          fixes.nextChargeDate = nextChargeDate;
        }
        if (Object.keys(fixes).length > 0) {
          membership = await prisma.membership.update({ where: { id: membership.id }, data: fixes });
        }
      }
    } else {
      const amount = toNumber(keva.Amount);
      const monthlyAgorot = amount != null ? shekelsToAgorot(amount) : 0;
      membership = await prisma.membership.create({
        data: {
          referenceCode: generateBillId(),
          fullName: keva.ClientName?.trim() || "Unknown (imported)",
          email: keva.Mail?.trim() || "",
          phone: keva.Phone?.trim() || null,
          address: keva.Adresse?.trim() || null,
          city: keva.City?.trim() || null,
          tier: inferTier(monthlyAgorot),
          monthlyAgorot,
          kevaId: keva.KevaId,
          status: inferStatus(keva),
          nextChargeDate: parseNedarimDate(keva.NextDate),
          createdAt: parseNedarimDate(keva.CreationDate) ?? undefined,
          createdBy: "nedarim-import",
        },
      });
      imported++;
    }

    // Always re-sync, even for a membership that already looks fully
    // imported - GetKevaId isn't rate-limited, and a "looks complete"
    // membership is exactly the case that needs re-checking after a fix
    // like this one (wrong amounts/dates on already-imported history,
    // never caught by a simple count check since the count was already
    // right - just the values weren't).
    paymentsImported += await syncMembershipHistory(membership.id, keva.KevaId, membership.monthlyAgorot);
  }

  revalidatePath("/admin/memberships");
  return { ok: true, imported, skipped, paymentsImported };
}

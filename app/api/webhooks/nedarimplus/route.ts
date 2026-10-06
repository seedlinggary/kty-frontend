import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { NEDARIM_WEBHOOK_IPS, extractReferenceFromComment } from "@/lib/nedarim";
import { toNumber, parseNedarimDate } from "@/lib/nedarim-parsing";
import { shekelsToAgorot } from "@/lib/money";
import { recordAuditLog } from "@/lib/audit-log";

/**
 * Resolves the amount for a charge against a record that has a known
 * "expected" amount (Bill/Donation/PaymentLink all lock in a fixed amount at
 * creation; Membership's recurring rate). NedarimPlus's webhook Amount field
 * isn't always a clean parseable number in practice (same unreliability
 * already confirmed on the read-only reporting API) - when it isn't, this
 * falls back to the expected amount rather than recording a clearly-wrong
 * ₪0, and flags the result as estimated so nothing downstream treats it as
 * a confirmed figure.
 */
function resolveAmount(rawAmount: number | null, expectedAgorot: number): { amountAgorot: number; isEstimated: boolean } {
  if (rawAmount != null) return { amountAgorot: shekelsToAgorot(rawAmount), isEstimated: false };
  return { amountAgorot: expectedAgorot, isEstimated: true };
}

/**
 * Creates the Transaction, treating a unique-constraint violation on
 * nedarimTransactionId (see schema) as "someone else already inserted this
 * exact charge" rather than a real error - the DB-level backstop for the
 * TOCTOU race in the findFirst-then-create pattern every handler uses
 * (NedarimPlus is confirmed to sometimes retry a webhook delivery).
 */
async function createTransaction(data: Prisma.TransactionCreateInput): Promise<{ created: boolean }> {
  try {
    await prisma.transaction.create({ data });
    return { created: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { created: false };
    }
    throw err;
  }
}

interface NedarimWebhookPayload {
  TransactionId?: string | number;
  Amount?: string | number;
  Currency?: string | number;
  Confirmation?: string;
  Comments?: string;
  ClientName?: string;
  /** Present on BOTH the Keva-setup event and subsequent recurring charges. */
  KevaId?: string | number;
  /** Only present on the one-time Keva-setup event, never on a regular charge. */
  NextDate?: string;
  [key: string]: unknown;
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

/** Resolves any still-open follow-up for this payable - the payment succeeded, so whatever previously looked stalled is resolved, no admin action needed. */
async function autoResolveFollowUps(where: {
  billId?: string;
  donationId?: string;
  membershipId?: string;
  paymentLinkId?: string;
}) {
  await prisma.paymentFollowUp.updateMany({
    where: { ...where, status: { in: ["OPEN", "EMAIL_SENT"] } },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
}

async function handleBill(referenceCode: string, payload: NedarimWebhookPayload, rawAmount: number | null) {
  const bill = await prisma.bill.findUnique({ where: { referenceCode } });
  if (!bill) return { matched: false };

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: true, duplicate: true };
  }

  const { amountAgorot, isEstimated } = resolveAmount(rawAmount, bill.totalAgorot);
  const { created } = await createTransaction({
    bill: { connect: { id: bill.id } },
    nedarimTransactionId: transactionId,
    confirmation: payload.Confirmation ?? null,
    amountAgorot,
    amountIsEstimated: isEstimated,
    source: "webhook",
    rawPayload: JSON.parse(JSON.stringify(payload)),
  });
  if (!created) return { matched: true, duplicate: true };

  const amountMatches = !isEstimated && amountAgorot === bill.totalAgorot;
  if (amountMatches && bill.status !== "CANCELLED") {
    await prisma.bill.update({ where: { id: bill.id }, data: { status: "PAID" } });
    await autoResolveFollowUps({ billId: bill.id });
  } else if (!amountMatches) {
    console.error(
      `[nedarim webhook] amount ${isEstimated ? "unparseable" : "mismatch"} for bill ${referenceCode}: expected ${bill.totalAgorot}, got ${isEstimated ? "unparseable" : amountAgorot}`
    );
  }
  return { matched: true, amountMatches };
}

async function handleDonation(referenceCode: string, payload: NedarimWebhookPayload, rawAmount: number | null) {
  const donation = await prisma.donation.findUnique({ where: { referenceCode } });
  if (!donation) return { matched: false };

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: true, duplicate: true };
  }

  const { amountAgorot, isEstimated } = resolveAmount(rawAmount, donation.amountAgorot);
  const { created } = await createTransaction({
    donation: { connect: { id: donation.id } },
    nedarimTransactionId: transactionId,
    confirmation: payload.Confirmation ?? null,
    amountAgorot,
    amountIsEstimated: isEstimated,
    source: "webhook",
    rawPayload: JSON.parse(JSON.stringify(payload)),
  });
  if (!created) return { matched: true, duplicate: true };

  // Donation amounts are locked in at creation (same "locked amount,
  // redirect, webhook" pattern as Bill) - same amount-match gate as Bill,
  // which this previously lacked, silently marking PAID on whatever amount
  // the webhook happened to carry even if it didn't match what was charged.
  const amountMatches = !isEstimated && amountAgorot === donation.amountAgorot;
  if (amountMatches && donation.status !== "CANCELLED") {
    await prisma.donation.update({ where: { id: donation.id }, data: { status: "PAID" } });
    await autoResolveFollowUps({ donationId: donation.id });
  } else if (!amountMatches) {
    console.error(
      `[nedarim webhook] amount ${isEstimated ? "unparseable" : "mismatch"} for donation ${referenceCode}: expected ${donation.amountAgorot}, got ${isEstimated ? "unparseable" : amountAgorot}`
    );
  }
  return { matched: true, amountMatches };
}

async function handlePaymentLink(referenceCode: string, payload: NedarimWebhookPayload, rawAmount: number | null) {
  const link = await prisma.paymentLink.findUnique({ where: { referenceCode } });
  if (!link) return { matched: false };

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: true, duplicate: true };
  }

  const { amountAgorot, isEstimated } = resolveAmount(rawAmount, link.amountAgorot);
  const { created } = await createTransaction({
    paymentLink: { connect: { id: link.id } },
    nedarimTransactionId: transactionId,
    confirmation: payload.Confirmation ?? null,
    amountAgorot,
    amountIsEstimated: isEstimated,
    source: "webhook",
    rawPayload: JSON.parse(JSON.stringify(payload)),
  });
  if (!created) return { matched: true, duplicate: true };

  // A payment link is explicitly "pay this exact predetermined amount" -
  // same amount-match gate as Bill, which this previously lacked, silently
  // marking PAID regardless of whether the charged amount matched the link.
  const amountMatches = !isEstimated && amountAgorot === link.amountAgorot;
  if (amountMatches && link.status !== "CANCELLED") {
    await prisma.paymentLink.update({ where: { id: link.id }, data: { status: "PAID" } });
    await autoResolveFollowUps({ paymentLinkId: link.id });
  } else if (!amountMatches) {
    console.error(
      `[nedarim webhook] amount ${isEstimated ? "unparseable" : "mismatch"} for payment link ${referenceCode}: expected ${link.amountAgorot}, got ${isEstimated ? "unparseable" : amountAgorot}`
    );
  }
  return { matched: true, amountMatches };
}

/** Membership has two distinct webhook shapes: the one-time Keva-setup event (KevaId + NextDate, no TransactionId), and every subsequent monthly charge (TransactionId present, tagged with the same KevaId). */
async function handleMembership(referenceCode: string, payload: NedarimWebhookPayload, rawAmount: number | null) {
  const membership = await prisma.membership.findUnique({ where: { referenceCode } });
  if (!membership) return { matched: false };

  const kevaId = payload.KevaId != null ? String(payload.KevaId) : null;
  const isSetupEvent = Boolean(kevaId) && payload.TransactionId == null;

  if (isSetupEvent) {
    const nextChargeDate = parseNedarimDate(payload.NextDate);
    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        kevaId,
        status: "ACTIVE",
        nextChargeDate,
      },
    });
    await autoResolveFollowUps({ membershipId: membership.id });
    return { matched: true, setup: true };
  }

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: true, duplicate: true };
  }

  const { amountAgorot, isEstimated } = resolveAmount(rawAmount, membership.monthlyAgorot);

  // The charge really happened - NedarimPlus's own standing order isn't
  // touched by anything in this codebase (confirmed: no write/edit/cancel
  // call to NedarimPlus exists anywhere), so staff cancelling a membership
  // here has zero effect on the real recurring charge. Keep the Transaction
  // either way (the money moved, regardless of our status field), but if
  // staff marked this CANCELLED, don't silently flip it back to ACTIVE as
  // if nothing happened - that would hide exactly the mismatch staff need
  // to go fix directly in NedarimPlus.
  const { created } = await createTransaction({
    membership: { connect: { id: membership.id } },
    nedarimTransactionId: transactionId,
    confirmation: payload.Confirmation ?? null,
    amountAgorot,
    amountIsEstimated: isEstimated,
    source: "webhook",
    rawPayload: JSON.parse(JSON.stringify(payload)),
  });
  if (!created) return { matched: true, duplicate: true };

  if (membership.status === "CANCELLED") {
    await recordAuditLog({
      action: "unexpected_charge_while_cancelled",
      recordType: "membership",
      recordId: membership.id,
      changes: {
        note: {
          before: null,
          after: "NedarimPlus charged this standing order again after it was marked Cancelled here - the real standing order was likely never cancelled directly in NedarimPlus.",
        },
      },
    });
    return { matched: true, chargedWhileCancelled: true };
  }

  // UTC arithmetic deliberately, so this doesn't shift by a few hours depending
  // on the server process's local timezone (dev machine vs. Vercel's UTC).
  const nextChargeDate = membership.nextChargeDate
    ? new Date(
        Date.UTC(
          membership.nextChargeDate.getUTCFullYear(),
          membership.nextChargeDate.getUTCMonth() + 1,
          membership.nextChargeDate.getUTCDate()
        )
      )
    : null;

  await prisma.membership.update({
    where: { id: membership.id },
    data: {
      kevaId: kevaId ?? membership.kevaId,
      status: "ACTIVE",
      lastChargeAt: new Date(),
      nextChargeDate,
    },
  });
  await autoResolveFollowUps({ membershipId: membership.id });
  return { matched: true };
}

/** A recurring charge for a membership whose Avour/Comments didn't carry the original MEM- reference (NedarimPlus doesn't guarantee it repeats every month) - fall back to matching by KevaId instead. */
async function handleMembershipByKevaId(kevaId: string, payload: NedarimWebhookPayload, rawAmount: number | null) {
  const membership = await prisma.membership.findUnique({ where: { kevaId } });
  if (!membership) return { matched: false };
  return handleMembership(membership.referenceCode, payload, rawAmount);
}

/**
 * A successful transaction that doesn't match anything our own system
 * generated - a pre-existing standing order set up directly in NedarimPlus,
 * or any other payment link shared outside this app. Recorded for a complete
 * picture of everything coming through the Mosad, not silently dropped.
 */
async function recordExternalTransaction(payload: NedarimWebhookPayload, rawAmount: number | null) {
  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.externalTransaction.findUnique({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: false, external: true, duplicate: true };
  }

  // No record of ours to borrow an expected amount from - this is someone
  // else's standing order/link entirely. Still worth keeping as 0 rather
  // than dropping the row, but logged so an unparseable Amount here doesn't
  // pass completely silently.
  if (rawAmount == null) {
    console.error("[nedarim webhook] unparseable Amount on an external (unmatched) transaction:", payload.Amount);
  }
  const amountAgorot = rawAmount != null ? shekelsToAgorot(rawAmount) : 0;

  try {
    await prisma.externalTransaction.create({
      data: {
        nedarimTransactionId: transactionId,
        amountAgorot,
        clientName: payload.ClientName ? String(payload.ClientName) : null,
        phone: payload.Phone ? String(payload.Phone) : null,
        email: payload.Email ? String(payload.Email) : null,
        groupe: payload.Groupe ? String(payload.Groupe) : null,
        comments: payload.Comments ?? null,
        confirmation: payload.Confirmation ?? null,
        kevaId: payload.KevaId != null ? String(payload.KevaId) : null,
        rawPayload: JSON.parse(JSON.stringify(payload)),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { matched: false, external: true, duplicate: true };
    }
    throw err;
  }
  return { matched: false, external: true };
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  if (!clientIp || !NEDARIM_WEBHOOK_IPS.includes(clientIp)) {
    console.error(`[nedarim webhook] rejected request from untrusted IP: ${clientIp}`);
    return NextResponse.json({ ok: false, error: "untrusted source" }, { status: 403 });
  }

  let payload: NedarimWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const rawAmount = toNumber(payload.Amount);
  const reference = extractReferenceFromComment(payload.Comments);

  if (!reference) {
    // A recurring membership charge after the first one may not carry the
    // original Avour comment forward - try matching by KevaId before falling
    // back to "this is some other NedarimPlus transaction entirely."
    if (payload.KevaId != null) {
      const result = await handleMembershipByKevaId(String(payload.KevaId), payload, rawAmount);
      if (result.matched) return NextResponse.json({ ok: true, ...result });
    }
    const result = await recordExternalTransaction(payload, rawAmount);
    return NextResponse.json({ ok: true, ...result });
  }

  let result: { matched: boolean; [key: string]: unknown };
  switch (reference.kind) {
    case "BILL":
      result = await handleBill(reference.code, payload, rawAmount);
      break;
    case "DON":
      result = await handleDonation(reference.code, payload, rawAmount);
      break;
    case "LINK":
      result = await handlePaymentLink(reference.code, payload, rawAmount);
      break;
    case "MEM":
      result = await handleMembership(reference.code, payload, rawAmount);
      break;
  }

  if (!result.matched) {
    // The comment matched one of our prefixes but no record exists for that
    // code (e.g. deleted, or a coincidental collision) - still worth keeping,
    // rather than silently losing a real payment.
    console.error(`[nedarim webhook] ${reference.kind}- reference found but no matching record: ${reference.code}`);
    const external = await recordExternalTransaction(payload, rawAmount);
    return NextResponse.json({ ok: true, ...result, ...external });
  }

  return NextResponse.json({ ok: true, ...result });
}

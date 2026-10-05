import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NEDARIM_WEBHOOK_IPS, extractReferenceFromComment } from "@/lib/nedarim";
import { shekelsToAgorot } from "@/lib/money";

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

async function handleBill(referenceCode: string, payload: NedarimWebhookPayload, amountAgorot: number) {
  const bill = await prisma.bill.findUnique({ where: { referenceCode } });
  if (!bill) return { matched: false };

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: true, duplicate: true };
  }

  await prisma.transaction.create({
    data: {
      billId: bill.id,
      nedarimTransactionId: transactionId,
      confirmation: payload.Confirmation ?? null,
      amountAgorot,
      source: "webhook",
      rawPayload: JSON.parse(JSON.stringify(payload)),
    },
  });

  const amountMatches = amountAgorot === bill.totalAgorot;
  if (amountMatches && bill.status !== "CANCELLED") {
    await prisma.bill.update({ where: { id: bill.id }, data: { status: "PAID" } });
    await autoResolveFollowUps({ billId: bill.id });
  } else if (!amountMatches) {
    console.error(`[nedarim webhook] amount mismatch for bill ${referenceCode}: expected ${bill.totalAgorot}, got ${amountAgorot}`);
  }
  return { matched: true, amountMatches };
}

async function handleDonation(referenceCode: string, payload: NedarimWebhookPayload, amountAgorot: number) {
  const donation = await prisma.donation.findUnique({ where: { referenceCode } });
  if (!donation) return { matched: false };

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: true, duplicate: true };
  }

  await prisma.transaction.create({
    data: {
      donationId: donation.id,
      nedarimTransactionId: transactionId,
      confirmation: payload.Confirmation ?? null,
      amountAgorot,
      source: "webhook",
      rawPayload: JSON.parse(JSON.stringify(payload)),
    },
  });

  if (donation.status !== "CANCELLED") {
    await prisma.donation.update({ where: { id: donation.id }, data: { status: "PAID" } });
    await autoResolveFollowUps({ donationId: donation.id });
  }
  return { matched: true };
}

async function handlePaymentLink(referenceCode: string, payload: NedarimWebhookPayload, amountAgorot: number) {
  const link = await prisma.paymentLink.findUnique({ where: { referenceCode } });
  if (!link) return { matched: false };

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: true, duplicate: true };
  }

  await prisma.transaction.create({
    data: {
      paymentLinkId: link.id,
      nedarimTransactionId: transactionId,
      confirmation: payload.Confirmation ?? null,
      amountAgorot,
      source: "webhook",
      rawPayload: JSON.parse(JSON.stringify(payload)),
    },
  });

  if (link.status !== "CANCELLED") {
    await prisma.paymentLink.update({ where: { id: link.id }, data: { status: "PAID" } });
    await autoResolveFollowUps({ paymentLinkId: link.id });
  }
  return { matched: true };
}

/** Membership has two distinct webhook shapes: the one-time Keva-setup event (KevaId + NextDate, no TransactionId), and every subsequent monthly charge (TransactionId present, tagged with the same KevaId). */
async function handleMembership(referenceCode: string, payload: NedarimWebhookPayload, amountAgorot: number) {
  const membership = await prisma.membership.findUnique({ where: { referenceCode } });
  if (!membership) return { matched: false };

  const kevaId = payload.KevaId != null ? String(payload.KevaId) : null;
  const isSetupEvent = Boolean(kevaId) && payload.TransactionId == null;

  if (isSetupEvent) {
    const nextChargeDate = payload.NextDate ? new Date(payload.NextDate) : null;
    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        kevaId,
        status: "ACTIVE",
        nextChargeDate: nextChargeDate && !Number.isNaN(nextChargeDate.getTime()) ? nextChargeDate : null,
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

  await prisma.transaction.create({
    data: {
      membershipId: membership.id,
      nedarimTransactionId: transactionId,
      confirmation: payload.Confirmation ?? null,
      amountAgorot,
      source: "webhook",
      rawPayload: JSON.parse(JSON.stringify(payload)),
    },
  });

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
async function handleMembershipByKevaId(kevaId: string, payload: NedarimWebhookPayload, amountAgorot: number) {
  const membership = await prisma.membership.findUnique({ where: { kevaId } });
  if (!membership) return { matched: false };
  return handleMembership(membership.referenceCode, payload, amountAgorot);
}

/**
 * A successful transaction that doesn't match anything our own system
 * generated - a pre-existing standing order set up directly in NedarimPlus,
 * or any other payment link shared outside this app. Recorded for a complete
 * picture of everything coming through the Mosad, not silently dropped.
 */
async function recordExternalTransaction(payload: NedarimWebhookPayload, amountAgorot: number) {
  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.externalTransaction.findUnique({ where: { nedarimTransactionId: transactionId } });
    if (existing) return { matched: false, external: true, duplicate: true };
  }

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

  const amountAgorot = shekelsToAgorot(Number(payload.Amount) || 0);
  const reference = extractReferenceFromComment(payload.Comments);

  if (!reference) {
    // A recurring membership charge after the first one may not carry the
    // original Avour comment forward - try matching by KevaId before falling
    // back to "this is some other NedarimPlus transaction entirely."
    if (payload.KevaId != null) {
      const result = await handleMembershipByKevaId(String(payload.KevaId), payload, amountAgorot);
      if (result.matched) return NextResponse.json({ ok: true, ...result });
    }
    const result = await recordExternalTransaction(payload, amountAgorot);
    return NextResponse.json({ ok: true, ...result });
  }

  let result: { matched: boolean; [key: string]: unknown };
  switch (reference.kind) {
    case "BILL":
      result = await handleBill(reference.code, payload, amountAgorot);
      break;
    case "DON":
      result = await handleDonation(reference.code, payload, amountAgorot);
      break;
    case "LINK":
      result = await handlePaymentLink(reference.code, payload, amountAgorot);
      break;
    case "MEM":
      result = await handleMembership(reference.code, payload, amountAgorot);
      break;
  }

  if (!result.matched) {
    // The comment matched one of our prefixes but no record exists for that
    // code (e.g. deleted, or a coincidental collision) - still worth keeping,
    // rather than silently losing a real payment.
    console.error(`[nedarim webhook] ${reference.kind}- reference found but no matching record: ${reference.code}`);
    const external = await recordExternalTransaction(payload, amountAgorot);
    return NextResponse.json({ ok: true, ...result, ...external });
  }

  return NextResponse.json({ ok: true, ...result });
}

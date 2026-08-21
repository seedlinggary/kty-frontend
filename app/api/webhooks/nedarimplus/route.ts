import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NEDARIM_WEBHOOK_IPS, extractBillIdFromComment } from "@/lib/nedarim";
import { shekelsToAgorot } from "@/lib/money";

interface NedarimWebhookPayload {
  TransactionId?: string | number;
  Amount?: string | number;
  Currency?: string | number;
  Confirmation?: string;
  Comments?: string;
  ClientName?: string;
  [key: string]: unknown;
}

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip");
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

  const referenceCode = extractBillIdFromComment(payload.Comments);
  if (!referenceCode) {
    // Expected and routine: this webhook receives every transaction on the Mosad
    // (donations, membership dues, etc.), not just seat payments. No BILL- reference
    // means it's unrelated - skip silently, no need to log or store anything about it.
    return NextResponse.json({ ok: true, matched: false });
  }

  const bill = await prisma.bill.findUnique({ where: { referenceCode } });
  if (!bill) {
    // This one is worth flagging: the comment matched our BILL- pattern but no
    // bill record exists for it - could mean a bill was deleted, or (rarely)
    // an unrelated transaction's comment happened to collide with the pattern.
    console.error(`[nedarim webhook] BILL- reference found but no matching bill: ${referenceCode}`);
    return NextResponse.json({ ok: true, matched: false });
  }

  const transactionId = payload.TransactionId != null ? String(payload.TransactionId) : null;
  if (transactionId) {
    const existing = await prisma.transaction.findFirst({
      where: { nedarimTransactionId: transactionId },
    });
    if (existing) {
      return NextResponse.json({ ok: true, matched: true, duplicate: true });
    }
  }

  const amountAgorot = shekelsToAgorot(Number(payload.Amount) || 0);
  const amountMatches = amountAgorot === bill.totalAgorot;

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

  if (amountMatches && bill.status !== "CANCELLED") {
    await prisma.bill.update({ where: { id: bill.id }, data: { status: "PAID" } });
  } else if (!amountMatches) {
    console.error(
      `[nedarim webhook] amount mismatch for bill ${referenceCode}: expected ${bill.totalAgorot}, got ${amountAgorot}`
    );
  }

  return NextResponse.json({ ok: true, matched: true, amountMatches });
}

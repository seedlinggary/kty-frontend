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

  const billId = extractBillIdFromComment(payload.Comments);
  if (!billId) {
    console.error("[nedarim webhook] no BILL- reference found in Comments", payload);
    return NextResponse.json({ ok: true, matched: false });
  }

  const signup = await prisma.signup.findUnique({ where: { billId } });
  if (!signup) {
    console.error(`[nedarim webhook] no signup found for billId ${billId}`);
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
  const amountMatches = amountAgorot === signup.totalAgorot;

  await prisma.transaction.create({
    data: {
      signupId: signup.id,
      nedarimTransactionId: transactionId,
      confirmation: payload.Confirmation ?? null,
      amountAgorot,
      source: "webhook",
      rawPayload: JSON.parse(JSON.stringify(payload)),
    },
  });

  if (amountMatches && signup.status !== "CANCELLED") {
    await prisma.signup.update({ where: { id: signup.id }, data: { status: "PAID" } });
  } else if (!amountMatches) {
    console.error(
      `[nedarim webhook] amount mismatch for billId ${billId}: expected ${signup.totalAgorot}, got ${amountAgorot}`
    );
  }

  return NextResponse.json({ ok: true, matched: true, amountMatches });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchKevaList, isNedarimReportingConfigured } from "@/lib/nedarim-reports";
import { shekelsToAgorot } from "@/lib/money";

/**
 * For one-time payments (Bills/Donations/PaymentLinks), NedarimPlus never
 * tells us when a payment is declined - only successes fire a webhook, and
 * their transaction-history API only ever lists completed, cancelled, or
 * refunded transactions (never failed attempts). So the best available
 * signal there is: it's been sitting PENDING for a while with no success
 * webhook ever arriving.
 *
 * Memberships are different: NedarimPlus's standing-order reporting API
 * (GetKevaJson) genuinely exposes decline data, so those get checked for
 * real via checkMembershipDeclines() below, not just inferred from timing.
 *
 * This runs on a schedule (see vercel.json) and flags anything that needs
 * attention without an open follow-up already, so staff can review and
 * (optionally) email the person a fresh link - see /admin/payment-follow-ups.
 */
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Checks every standing order on the Mosad (ours and any pre-existing ones)
 * for a decline on its last charge attempt, via NedarimPlus's reporting API.
 * No-ops entirely if NEDARIM_APIPASSWORD isn't configured.
 */
async function checkMembershipDeclines(): Promise<number> {
  if (!isNedarimReportingConfigured()) return 0;

  const kevaList = await fetchKevaList();
  if (!kevaList) return 0;

  let created = 0;
  for (const keva of kevaList) {
    if (!keva.ErrorText) continue;

    const membership = await prisma.membership.findUnique({ where: { kevaId: keva.KevaId } });
    const link = membership ? { membershipId: membership.id } : null;

    const amountAgorot = keva.Amount != null ? shekelsToAgorot(Number(keva.Amount) || 0) : null;
    const diagnostics = {
      reason: "API_DECLINE" as const,
      failureReason: keva.ErrorText,
      notes: `Detected via NedarimPlus standing-order report (KevaId ${keva.KevaId}).`,
    };

    const existing = await prisma.paymentFollowUp.findFirst({
      where: link
        ? { ...link, status: { in: ["OPEN", "EMAIL_SENT"] } }
        : { externalKevaId: keva.KevaId, status: { in: ["OPEN", "EMAIL_SENT"] } },
    });

    if (existing) {
      await prisma.paymentFollowUp.update({ where: { id: existing.id }, data: diagnostics });
      continue;
    }

    if (link) {
      await prisma.paymentFollowUp.create({ data: { ...link, ...diagnostics } });
    } else {
      await prisma.paymentFollowUp.create({
        data: {
          ...diagnostics,
          externalFullName: keva.ClientName,
          externalPhone: keva.Phone,
          externalEmail: keva.Mail,
          externalAmountAgorot: amountAgorot,
          externalCategory: keva.Groupe,
          externalKevaId: keva.KevaId,
        },
      });
    }
    created++;
  }
  return created;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);
  let created = 0;

  type PayableLink = { billId?: string; donationId?: string; membershipId?: string; paymentLinkId?: string };
  const stalePayables: PayableLink[] = [];

  const bills = await prisma.bill.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } } });
  stalePayables.push(...bills.map((b) => ({ billId: b.id })));

  const donations = await prisma.donation.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } } });
  stalePayables.push(...donations.map((d) => ({ donationId: d.id })));

  const links = await prisma.paymentLink.findMany({ where: { status: "PENDING", createdAt: { lt: cutoff } } });
  stalePayables.push(...links.map((l) => ({ paymentLinkId: l.id })));

  // Memberships: PENDING too long means the Keva setup itself never confirmed.
  // ACTIVE memberships whose nextChargeDate has passed are a different kind of
  // problem (an established standing order that stopped charging) - flagged as
  // PAST_DUE rather than compared against the same grace window.
  const pendingMemberships = await prisma.membership.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
  });
  stalePayables.push(...pendingMemberships.map((m) => ({ membershipId: m.id })));

  const overdueMemberships = await prisma.membership.findMany({
    where: { status: "ACTIVE", nextChargeDate: { lt: cutoff } },
  });
  if (overdueMemberships.length > 0) {
    await prisma.membership.updateMany({
      where: { id: { in: overdueMemberships.map((m) => m.id) } },
      data: { status: "PAST_DUE" },
    });
  }
  stalePayables.push(...overdueMemberships.map((m) => ({ membershipId: m.id })));

  for (const link of stalePayables) {
    const existing = await prisma.paymentFollowUp.findFirst({
      where: { ...link, status: { in: ["OPEN", "EMAIL_SENT"] } },
    });
    if (existing) continue;

    await prisma.paymentFollowUp.create({
      data: { ...link, reason: "STALE_PENDING" },
    });
    created++;
  }

  const apiDeclinesCreated = await checkMembershipDeclines();

  return NextResponse.json({
    ok: true,
    created: created + apiDeclinesCreated,
    stalePendingChecked: stalePayables.length,
    apiDeclinesCreated,
  });
}

"use server";

import { prisma } from "@/lib/prisma";
import type { ItemKind } from "@/lib/actions/families";

export type CombineCandidate = {
  kind: ItemKind;
  id: string;
  label: string;
  familyName: string | null;
};

const RESULT_LIMIT = 8;

/**
 * Powers the per-row "Combine with..." picker - a lightweight, ad-hoc
 * search across every mergeable record type by name/email/phone, so staff
 * can combine two records that live on completely different pages (a
 * Donation and a Membership, say) without first going to Search and
 * checking boxes across every category by hand. Excludes whatever the
 * picker was opened from, so a row can't be "combined" with itself.
 */
export async function searchCombineCandidates(
  query: string,
  exclude: { kind: ItemKind; id: string }
): Promise<CombineCandidate[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };

  const [bills, donations, memberships, paymentLinks, formResponses, externalTransactions] = await Promise.all([
    prisma.bill.findMany({
      where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }] },
      include: { family: { select: { fullName: true } } },
      take: RESULT_LIMIT,
    }),
    prisma.donation.findMany({
      where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }] },
      include: { family: { select: { fullName: true } } },
      take: RESULT_LIMIT,
    }),
    prisma.membership.findMany({
      where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }] },
      include: { family: { select: { fullName: true } } },
      take: RESULT_LIMIT,
    }),
    prisma.paymentLink.findMany({
      where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }, { label: contains }] },
      include: { family: { select: { fullName: true } } },
      take: RESULT_LIMIT,
    }),
    prisma.formResponse.findMany({
      where: { deletedAt: null },
      include: { form: { include: { fields: true } }, family: { select: { fullName: true } } },
      take: 50,
    }),
    prisma.externalTransaction.findMany({
      where: { OR: [{ clientName: contains }, { email: contains }, { phone: contains }] },
      include: { family: { select: { fullName: true } } },
      take: RESULT_LIMIT,
    }),
  ]);

  const candidates: CombineCandidate[] = [
    ...bills.map((b) => ({ kind: "bill" as ItemKind, id: b.id, label: `${b.fullName} — Holiday Seats (${b.status})`, familyName: b.family?.fullName ?? null })),
    ...donations.map((d) => ({ kind: "donation" as ItemKind, id: d.id, label: `${d.fullName} — Donation (${d.status})`, familyName: d.family?.fullName ?? null })),
    ...memberships.map((m) => ({ kind: "membership" as ItemKind, id: m.id, label: `${m.fullName} — Membership (${m.status.replace("_", " ")})`, familyName: m.family?.fullName ?? null })),
    ...paymentLinks.map((l) => ({ kind: "paymentLink" as ItemKind, id: l.id, label: `${l.fullName || l.label} — Payment Link "${l.label}"`, familyName: l.family?.fullName ?? null })),
    ...externalTransactions.map((t) => ({ kind: "externalTransaction" as ItemKind, id: t.id, label: `${t.clientName || "Unknown"} — Other Transaction`, familyName: t.family?.fullName ?? null })),
  ];

  // FormResponse has no fixed name/email/phone column, so the text match has
  // to happen client-side here against its extracted identity rather than in
  // the where clause above.
  const { extractFormResponseIdentity } = await import("@/lib/form-response-identity");
  const lowerQ = q.toLowerCase();
  for (const r of formResponses) {
    const identity = extractFormResponseIdentity(r.answers as Record<string, unknown>, r.form.fields, `Form: ${r.form.title}`);
    const haystack = `${identity.fullName} ${identity.email ?? ""} ${identity.phone ?? ""}`.toLowerCase();
    if (haystack.includes(lowerQ)) {
      candidates.push({
        kind: "formResponse",
        id: r.id,
        label: `${identity.fullName} — Form Submission (${r.form.title})`,
        familyName: r.family?.fullName ?? null,
      });
    }
  }

  return candidates.filter((c) => !(c.kind === exclude.kind && c.id === exclude.id)).slice(0, RESULT_LIMIT);
}

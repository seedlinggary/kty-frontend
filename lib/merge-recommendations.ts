import { prisma } from "@/lib/prisma";
import { extractFormResponseIdentity } from "@/lib/form-response-identity";
import type { ItemKind } from "@/lib/actions/users";

type RecommendationItem = {
  kind: ItemKind;
  id: string;
  label: string;
  userId: string | null;
  userName: string | null;
};

export type Recommendation = {
  key: string;
  matchedOn: ("email" | "phone")[];
  sharedValues: string[];
  items: RecommendationItem[];
  existingUserNames: string[];
};

// A value shared by more than this many records is more likely a shared
// office email/phone than the same individual - skip it as noise rather
// than rendering an unusably large recommendation.
const MAX_CLUSTER_SIZE = 15;

function normalizeEmail(email: string | null | undefined): string | null {
  const v = email?.trim().toLowerCase();
  return v ? v : null;
}

function normalizePhone(phone: string | null | undefined): string | null {
  const v = phone?.replace(/\D/g, "");
  return v && v.length >= 7 ? v : null;
}

type RawItem = {
  kind: ItemKind;
  id: string;
  label: string;
  email: string | null;
  phone: string | null;
  userId: string | null;
  userName: string | null;
};

class UnionFind {
  private parent = new Map<number, number>();

  find(x: number): number {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    this.parent.set(x, root);
    return root;
  }

  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/**
 * Scans every mergeable record type for ones sharing a normalized email or
 * phone number that aren't already combined onto the same User, and
 * recommends combining them. Doesn't touch anything by itself - staff act
 * on a recommendation with the same "Combine Into One User" action used
 * everywhere else, or ignore it if it's a false match (e.g. a shared office
 * contact rather than the same individual).
 */
export async function findMergeRecommendations(): Promise<Recommendation[]> {
  const [bills, donations, memberships, paymentLinks, externalTransactions, formResponses] = await Promise.all([
    prisma.bill.findMany({
      include: { user: { select: { fullName: true } } },
    }),
    prisma.donation.findMany({
      include: { user: { select: { fullName: true } } },
    }),
    prisma.membership.findMany({
      include: { user: { select: { fullName: true } } },
    }),
    prisma.paymentLink.findMany({
      include: { user: { select: { fullName: true } } },
    }),
    prisma.externalTransaction.findMany({
      include: { user: { select: { fullName: true } } },
    }),
    prisma.formResponse.findMany({
      where: { deletedAt: null },
      include: { form: { include: { fields: true } }, user: { select: { fullName: true } } },
    }),
  ]);

  const items: RawItem[] = [
    ...bills.map((b) => ({
      kind: "bill" as ItemKind,
      id: b.id,
      label: `${b.fullName} — Holiday Seats (${b.status})`,
      email: b.email,
      phone: b.phone,
      userId: b.userId,
      userName: b.user?.fullName ?? null,
    })),
    ...donations.map((d) => ({
      kind: "donation" as ItemKind,
      id: d.id,
      label: `${d.fullName} — Donation (${d.status})`,
      email: d.email,
      phone: d.phone,
      userId: d.userId,
      userName: d.user?.fullName ?? null,
    })),
    ...memberships.map((m) => ({
      kind: "membership" as ItemKind,
      id: m.id,
      label: `${m.fullName} — Membership (${m.status.replace("_", " ")})`,
      email: m.email,
      phone: m.phone,
      userId: m.userId,
      userName: m.user?.fullName ?? null,
    })),
    ...paymentLinks.map((l) => ({
      kind: "paymentLink" as ItemKind,
      id: l.id,
      label: `${l.fullName || l.label} — Payment Link "${l.label}" (${l.status})`,
      email: l.email,
      phone: l.phone,
      userId: l.userId,
      userName: l.user?.fullName ?? null,
    })),
    ...externalTransactions.map((t) => ({
      kind: "externalTransaction" as ItemKind,
      id: t.id,
      label: `${t.clientName || "Unknown"} — Other Transaction`,
      email: t.email,
      phone: t.phone,
      userId: t.userId,
      userName: t.user?.fullName ?? null,
    })),
    ...formResponses.map((r) => {
      const identity = extractFormResponseIdentity(
        r.answers as Record<string, unknown>,
        r.form.fields,
        `Form: ${r.form.title}`
      );
      return {
        kind: "formResponse" as ItemKind,
        id: r.id,
        label: `${identity.fullName} — Form Submission (${r.form.title})`,
        email: identity.email,
        phone: identity.phone,
        userId: r.userId,
        userName: r.user?.fullName ?? null,
      };
    }),
  ];

  const emails = items.map((i) => normalizeEmail(i.email));
  const phones = items.map((i) => normalizePhone(i.phone));

  const byEmail = new Map<string, number[]>();
  const byPhone = new Map<string, number[]>();
  items.forEach((_, i) => {
    const email = emails[i];
    const phone = phones[i];
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), i]);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) ?? []), i]);
  });

  const uf = new UnionFind();
  for (const idxs of byEmail.values()) {
    if (idxs.length > 1) for (let i = 1; i < idxs.length; i++) uf.union(idxs[0], idxs[i]);
  }
  for (const idxs of byPhone.values()) {
    if (idxs.length > 1) for (let i = 1; i < idxs.length; i++) uf.union(idxs[0], idxs[i]);
  }

  const clusters = new Map<number, number[]>();
  items.forEach((_, i) => {
    const root = uf.find(i);
    clusters.set(root, [...(clusters.get(root) ?? []), i]);
  });

  const recommendations: Recommendation[] = [];
  for (const idxs of clusters.values()) {
    if (idxs.length < 2 || idxs.length > MAX_CLUSTER_SIZE) continue;

    const clusterItems = idxs.map((i) => items[i]);
    const distinctUserIds = new Set(clusterItems.filter((it) => it.userId).map((it) => it.userId!));
    // Already fully resolved: every item in this cluster already belongs to
    // the same single User - nothing to recommend.
    if (distinctUserIds.size === 1 && clusterItems.every((it) => it.userId)) continue;

    const matchedOn = new Set<"email" | "phone">();
    const sharedValues = new Set<string>();
    const localEmailCounts = new Map<string, number>();
    const localPhoneCounts = new Map<string, number>();
    for (const i of idxs) {
      if (emails[i]) localEmailCounts.set(emails[i]!, (localEmailCounts.get(emails[i]!) ?? 0) + 1);
      if (phones[i]) localPhoneCounts.set(phones[i]!, (localPhoneCounts.get(phones[i]!) ?? 0) + 1);
    }
    for (const [email, count] of localEmailCounts) {
      if (count > 1) {
        matchedOn.add("email");
        sharedValues.add(email);
      }
    }
    for (const [phone, count] of localPhoneCounts) {
      if (count > 1) {
        matchedOn.add("phone");
        sharedValues.add(phone);
      }
    }
    if (matchedOn.size === 0) continue;

    recommendations.push({
      key: idxs.join("-"),
      matchedOn: Array.from(matchedOn),
      sharedValues: Array.from(sharedValues),
      items: clusterItems.map((it) => ({
        kind: it.kind,
        id: it.id,
        label: it.label,
        userId: it.userId,
        userName: it.userName,
      })),
      existingUserNames: Array.from(new Set(clusterItems.filter((it) => it.userName).map((it) => it.userName!))),
    });
  }

  return recommendations;
}

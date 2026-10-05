import { prisma } from "@/lib/prisma";

/**
 * Searches every NedarimPlus-related record and form submission for a
 * name/email/phone, so staff can pull up "everything about this person" from
 * one box instead of checking each admin page separately.
 */
export async function searchEverything(q: string) {
  const query = q.trim();
  if (!query) {
    return {
      bills: [],
      donations: [],
      memberships: [],
      paymentLinks: [],
      externalTransactions: [],
      untrackedFollowUps: [],
      formResponses: [],
    };
  }

  const contains = { contains: query, mode: "insensitive" as const };

  const [bills, donations, memberships, paymentLinks, externalTransactions, untrackedFollowUps, formResponses] =
    await Promise.all([
      prisma.bill.findMany({
        where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }] },
        include: { lineItems: { where: { deletedAt: null }, include: { holiday: true } }, person: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.donation.findMany({
        where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }, { address: contains }, { city: contains }] },
        include: { person: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.membership.findMany({
        where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }, { address: contains }, { city: contains }] },
        include: { transactions: { orderBy: { receivedAt: "desc" } }, person: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.paymentLink.findMany({
        where: { OR: [{ fullName: contains }, { email: contains }, { phone: contains }, { label: contains }] },
        include: { person: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.externalTransaction.findMany({
        where: { OR: [{ clientName: contains }, { email: contains }, { phone: contains }, { comments: contains }, { groupe: contains }] },
        include: { person: { select: { id: true, fullName: true } } },
        orderBy: { receivedAt: "desc" },
        take: 50,
      }),
      // A follow-up with no FK at all - a decline on a standing order (or similar) our system never created.
      prisma.paymentFollowUp.findMany({
        where: {
          billId: null,
          donationId: null,
          membershipId: null,
          paymentLinkId: null,
          OR: [{ externalFullName: contains }, { externalEmail: contains }, { externalPhone: contains }],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      // FormResponse.answers is a JSON blob keyed by dynamic field IDs, so a
      // typed Prisma filter can't search it generically - cast to text and
      // search the whole blob instead. Safe: the only interpolated value is
      // Prisma's own parameterized placeholder, not raw string concatenation.
      prisma.$queryRaw<
        {
          id: string;
          formId: string;
          createdAt: Date;
          title: string;
          slug: string;
          personId: string | null;
          personFullName: string | null;
        }[]
      >`
        SELECT fr.id, fr."formId", fr."createdAt", f.title, f.slug,
               fr."personId", p."fullName" AS "personFullName"
        FROM "FormResponse" fr
        JOIN "Form" f ON f.id = fr."formId"
        LEFT JOIN "Person" p ON p.id = fr."personId"
        WHERE fr."deletedAt" IS NULL AND fr.answers::text ILIKE ${`%${query}%`}
        ORDER BY fr."createdAt" DESC
        LIMIT 50
      `,
    ]);

  return {
    bills,
    donations,
    memberships,
    paymentLinks,
    externalTransactions,
    untrackedFollowUps,
    formResponses: formResponses.map((r) => ({
      ...r,
      person: r.personId ? { id: r.personId, fullName: r.personFullName ?? "" } : null,
    })),
  };
}

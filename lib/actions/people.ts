"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractFormResponseIdentity } from "@/lib/form-response-identity";

export type ItemKind = "bill" | "donation" | "membership" | "paymentLink" | "formResponse" | "externalTransaction";

type ContactInfo = {
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  personId: string | null;
};

async function getFormResponseContactInfo(id: string): Promise<ContactInfo | null> {
  const response = await prisma.formResponse.findUnique({
    where: { id },
    include: { form: { include: { fields: true } } },
  });
  if (!response) return null;

  const identity = extractFormResponseIdentity(
    response.answers as Record<string, unknown>,
    response.form.fields,
    `Form: ${response.form.title}`
  );
  return { ...identity, personId: response.personId };
}

async function getContactInfo(kind: ItemKind, id: string): Promise<ContactInfo | null> {
  if (kind === "bill") {
    const r = await prisma.bill.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: null, city: null, personId: r.personId } : null;
  }
  if (kind === "donation") {
    const r = await prisma.donation.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: r.address, city: r.city, personId: r.personId } : null;
  }
  if (kind === "membership") {
    const r = await prisma.membership.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: r.address, city: r.city, personId: r.personId } : null;
  }
  if (kind === "formResponse") {
    return getFormResponseContactInfo(id);
  }
  if (kind === "externalTransaction") {
    const r = await prisma.externalTransaction.findUnique({ where: { id } });
    return r ? { fullName: r.clientName ?? "Unknown", email: r.email, phone: r.phone, address: null, city: null, personId: r.personId } : null;
  }
  const r = await prisma.paymentLink.findUnique({ where: { id } });
  return r ? { fullName: r.fullName ?? r.label, email: r.email, phone: r.phone, address: null, city: null, personId: r.personId } : null;
}

async function setPersonId(byKind: Record<ItemKind, string[]>, personId: string | null) {
  await prisma.$transaction([
    ...(byKind.bill.length ? [prisma.bill.updateMany({ where: { id: { in: byKind.bill } }, data: { personId } })] : []),
    ...(byKind.donation.length ? [prisma.donation.updateMany({ where: { id: { in: byKind.donation } }, data: { personId } })] : []),
    ...(byKind.membership.length ? [prisma.membership.updateMany({ where: { id: { in: byKind.membership } }, data: { personId } })] : []),
    ...(byKind.paymentLink.length ? [prisma.paymentLink.updateMany({ where: { id: { in: byKind.paymentLink } }, data: { personId } })] : []),
    ...(byKind.formResponse.length ? [prisma.formResponse.updateMany({ where: { id: { in: byKind.formResponse } }, data: { personId } })] : []),
    ...(byKind.externalTransaction.length ? [prisma.externalTransaction.updateMany({ where: { id: { in: byKind.externalTransaction } }, data: { personId } })] : []),
  ]);
}

function emptyByKind(): Record<ItemKind, string[]> {
  return { bill: [], donation: [], membership: [], paymentLink: [], formResponse: [], externalTransaction: [] };
}

/**
 * Combines the checked search-result rows onto one Person, so the same real
 * individual's repeated NedarimPlus signups stop showing as unrelated
 * scattered records. If some selected rows already belong to one or more
 * existing People, those get folded together into a single one (and the
 * now-empty extras are deleted) rather than creating yet another duplicate.
 */
export async function mergeIntoPersonAction(formData: FormData) {
  const raw = formData.getAll("items").map(String);
  const items = raw
    .map((v) => {
      const [kind, id] = v.split(":");
      return { kind: kind as ItemKind, id };
    })
    .filter((i) => i.id);

  const redirectTo = String(formData.get("redirectTo") || "/admin/search");

  if (items.length < 2) {
    redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}mergeError=select-at-least-two`);
  }

  const infos = await Promise.all(items.map((i) => getContactInfo(i.kind, i.id)));
  const existingPersonIds = Array.from(new Set(infos.filter((i) => i?.personId).map((i) => i!.personId!)));

  let personId: string;
  if (existingPersonIds.length === 0) {
    const best = infos.find((i) => i?.email && i?.phone) ?? infos.find((i) => i?.email) ?? infos[0];
    const person = await prisma.person.create({
      data: {
        fullName: best?.fullName ?? "Unknown",
        email: best?.email ?? null,
        phone: best?.phone ?? null,
        address: best?.address ?? null,
        city: best?.city ?? null,
      },
    });
    personId = person.id;
  } else {
    personId = existingPersonIds[0];
    const otherPersonIds = existingPersonIds.slice(1);
    if (otherPersonIds.length > 0) {
      await prisma.$transaction([
        prisma.bill.updateMany({ where: { personId: { in: otherPersonIds } }, data: { personId } }),
        prisma.donation.updateMany({ where: { personId: { in: otherPersonIds } }, data: { personId } }),
        prisma.membership.updateMany({ where: { personId: { in: otherPersonIds } }, data: { personId } }),
        prisma.paymentLink.updateMany({ where: { personId: { in: otherPersonIds } }, data: { personId } }),
        prisma.formResponse.updateMany({ where: { personId: { in: otherPersonIds } }, data: { personId } }),
        prisma.externalTransaction.updateMany({ where: { personId: { in: otherPersonIds } }, data: { personId } }),
      ]);
      await prisma.person.deleteMany({ where: { id: { in: otherPersonIds } } });
    }
  }

  const byKind = emptyByKind();
  for (const item of items) byKind[item.kind].push(item.id);
  await setPersonId(byKind, personId);

  revalidatePath("/admin/search");
  revalidatePath("/admin/people");
  revalidatePath(`/admin/people/${personId}`);

  redirect(`/admin/people/${personId}`);
}

/**
 * Undoes a merge for one record. If the Person it belonged to has nothing
 * else linked afterward, the now-empty Person is removed too (never the
 * underlying Bill/Donation/Membership/PaymentLink itself).
 */
export async function unlinkFromPersonAction(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as ItemKind;
  const id = String(formData.get("id") ?? "");
  const personId = String(formData.get("personId") ?? "");
  if (!id || !personId) return;

  const byKind = emptyByKind();
  if (kind in byKind) byKind[kind].push(id);
  await setPersonId(byKind, null);

  const [bills, donations, memberships, paymentLinks, formResponses, externalTransactions] = await Promise.all([
    prisma.bill.count({ where: { personId } }),
    prisma.donation.count({ where: { personId } }),
    prisma.membership.count({ where: { personId } }),
    prisma.paymentLink.count({ where: { personId } }),
    prisma.formResponse.count({ where: { personId } }),
    prisma.externalTransaction.count({ where: { personId } }),
  ]);
  if (bills + donations + memberships + paymentLinks + formResponses + externalTransactions === 0) {
    await prisma.person.delete({ where: { id: personId } }).catch(() => {});
    revalidatePath("/admin/people");
    redirect("/admin/people");
  }

  revalidatePath(`/admin/people/${personId}`);
  revalidatePath("/admin/search");
}

export type UpdatePersonResult = { ok: true } | { ok: false; error: string };

export async function updatePersonAction(input: {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  notes?: string;
}): Promise<UpdatePersonResult> {
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Name is required." };

  await prisma.person.update({
    where: { id: input.id },
    data: {
      fullName,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  revalidatePath(`/admin/people/${input.id}`);
  revalidatePath("/admin/people");
  return { ok: true };
}

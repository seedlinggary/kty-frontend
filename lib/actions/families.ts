"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractFormResponseIdentity } from "@/lib/form-response-identity";
import { diffFields, recordAuditLog } from "@/lib/audit-log";

export type ItemKind = "bill" | "donation" | "membership" | "paymentLink" | "formResponse" | "externalTransaction";

type ContactInfo = {
  fullName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  familyId: string | null;
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
  return { ...identity, familyId: response.familyId };
}

async function getContactInfo(kind: ItemKind, id: string): Promise<ContactInfo | null> {
  if (kind === "bill") {
    const r = await prisma.bill.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: null, city: null, familyId: r.familyId } : null;
  }
  if (kind === "donation") {
    const r = await prisma.donation.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: r.address, city: r.city, familyId: r.familyId } : null;
  }
  if (kind === "membership") {
    const r = await prisma.membership.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: r.address, city: r.city, familyId: r.familyId } : null;
  }
  if (kind === "formResponse") {
    return getFormResponseContactInfo(id);
  }
  if (kind === "externalTransaction") {
    const r = await prisma.externalTransaction.findUnique({ where: { id } });
    return r ? { fullName: r.clientName ?? "Unknown", email: r.email, phone: r.phone, address: null, city: null, familyId: r.familyId } : null;
  }
  const r = await prisma.paymentLink.findUnique({ where: { id } });
  return r ? { fullName: r.fullName ?? r.label, email: r.email, phone: r.phone, address: null, city: null, familyId: r.familyId } : null;
}

async function setFamilyId(byKind: Record<ItemKind, string[]>, familyId: string | null) {
  await prisma.$transaction([
    ...(byKind.bill.length ? [prisma.bill.updateMany({ where: { id: { in: byKind.bill } }, data: { familyId } })] : []),
    ...(byKind.donation.length ? [prisma.donation.updateMany({ where: { id: { in: byKind.donation } }, data: { familyId } })] : []),
    ...(byKind.membership.length ? [prisma.membership.updateMany({ where: { id: { in: byKind.membership } }, data: { familyId } })] : []),
    ...(byKind.paymentLink.length ? [prisma.paymentLink.updateMany({ where: { id: { in: byKind.paymentLink } }, data: { familyId } })] : []),
    ...(byKind.formResponse.length ? [prisma.formResponse.updateMany({ where: { id: { in: byKind.formResponse } }, data: { familyId } })] : []),
    ...(byKind.externalTransaction.length ? [prisma.externalTransaction.updateMany({ where: { id: { in: byKind.externalTransaction } }, data: { familyId } })] : []),
  ]);
}

function emptyByKind(): Record<ItemKind, string[]> {
  return { bill: [], donation: [], membership: [], paymentLink: [], formResponse: [], externalTransaction: [] };
}

/**
 * Fills in only the fields the family doesn't already have (fullName still
 * "Unknown", or email/phone/address/city blank) from whichever just-merged
 * item has a value - including a form response's own extracted identity.
 * Never overwrites a value the family already has, even if a merged item
 * disagrees with it - staff-confirmed or previously-filled data always wins;
 * this only ever fills a genuine gap.
 */
async function fillBlankFamilyFields(familyId: string, infos: (ContactInfo | null)[]) {
  const family = await prisma.family.findUnique({ where: { id: familyId } });
  if (!family) return;

  const fixes: Partial<Pick<ContactInfo, "fullName" | "email" | "phone" | "address" | "city">> = {};
  const isBlank = (v: string | null | undefined) => !v || v.trim() === "";

  if (isBlank(family.fullName) || family.fullName === "Unknown") {
    const found = infos.find((i) => i?.fullName && i.fullName !== "Unknown");
    if (found) fixes.fullName = found.fullName;
  }
  for (const field of ["email", "phone", "address", "city"] as const) {
    if (isBlank(family[field])) {
      const found = infos.find((i) => !isBlank(i?.[field] ?? null));
      if (found) fixes[field] = found![field];
    }
  }

  if (Object.keys(fixes).length === 0) return;
  await prisma.family.update({ where: { id: familyId }, data: fixes });
  await recordAuditLog({
    action: "filled_blank_fields",
    recordType: "family",
    recordId: familyId,
    changes: diffFields(family, fixes),
  });
}

export type MergeActionState =
  | { ok: null }
  | { ok: true; familyId: string; familyName: string }
  | { ok: false; error: string };

/**
 * Combines the checked rows onto one Family, so the same household's
 * repeated NedarimPlus signups (a husband and wife filling out separate
 * forms/bills under their own name is the common case) stop showing as
 * unrelated scattered records. If some selected rows already belong to one
 * or more existing Families, those get folded together into a single one
 * (and the now-empty extras are deleted) rather than creating yet another
 * duplicate.
 *
 * Returns a result instead of redirecting - every caller shows this as a
 * dismissible toast with a link to the family, and stays on the page the
 * admin was already working on (a checked-row picker further down the same
 * list, or a recommendation further down the page) instead of yanking them
 * away from it.
 */
export async function mergeIntoFamilyAction(_prevState: MergeActionState, formData: FormData): Promise<MergeActionState> {
  const raw = formData.getAll("items").map(String);
  const items = raw
    .map((v) => {
      const [kind, id] = v.split(":");
      return { kind: kind as ItemKind, id };
    })
    .filter((i) => i.id);

  if (items.length < 2) {
    return { ok: false, error: "Check at least two rows before combining them into one family." };
  }

  const infos = await Promise.all(items.map((i) => getContactInfo(i.kind, i.id)));
  const existingFamilyIds = Array.from(new Set(infos.filter((i) => i?.familyId).map((i) => i!.familyId!)));

  let familyId: string;
  let isNewFamily = false;
  if (existingFamilyIds.length === 0) {
    const best = infos.find((i) => i?.email && i?.phone) ?? infos.find((i) => i?.email) ?? infos[0];
    const family = await prisma.family.create({
      data: {
        fullName: best?.fullName ?? "Unknown",
        email: best?.email ?? null,
        phone: best?.phone ?? null,
        address: best?.address ?? null,
        city: best?.city ?? null,
      },
    });
    familyId = family.id;
    isNewFamily = true;
    await recordAuditLog({
      action: "merge_created_family",
      recordType: "family",
      recordId: familyId,
      changes: diffFields({}, { fullName: family.fullName, email: family.email, mergedItemCount: items.length }),
    });
  } else {
    familyId = existingFamilyIds[0];
    const otherFamilyIds = existingFamilyIds.slice(1);
    if (otherFamilyIds.length > 0) {
      await prisma.$transaction([
        prisma.bill.updateMany({ where: { familyId: { in: otherFamilyIds } }, data: { familyId } }),
        prisma.donation.updateMany({ where: { familyId: { in: otherFamilyIds } }, data: { familyId } }),
        prisma.membership.updateMany({ where: { familyId: { in: otherFamilyIds } }, data: { familyId } }),
        prisma.paymentLink.updateMany({ where: { familyId: { in: otherFamilyIds } }, data: { familyId } }),
        prisma.formResponse.updateMany({ where: { familyId: { in: otherFamilyIds } }, data: { familyId } }),
        prisma.externalTransaction.updateMany({ where: { familyId: { in: otherFamilyIds } }, data: { familyId } }),
      ]);
      await prisma.family.deleteMany({ where: { id: { in: otherFamilyIds } } });
      for (const otherFamilyId of otherFamilyIds) {
        await recordAuditLog({
          action: "merged_into_other_family",
          recordType: "family",
          recordId: otherFamilyId,
          changes: diffFields({ mergedInto: null }, { mergedInto: familyId }),
        });
      }
    }
  }

  const byKind = emptyByKind();
  for (const item of items) byKind[item.kind].push(item.id);
  await setFamilyId(byKind, familyId);

  for (const item of items) {
    const info = infos[items.indexOf(item)];
    if (info?.familyId === familyId) continue;
    await recordAuditLog({
      action: "merge_into_family",
      recordType: item.kind,
      recordId: item.id,
      changes: diffFields({ familyId: info?.familyId ?? null }, { familyId }),
    });
  }

  if (!isNewFamily) await fillBlankFamilyFields(familyId, infos);

  const family = await prisma.family.findUnique({ where: { id: familyId } });

  revalidatePath("/admin/search");
  revalidatePath("/admin/families");
  revalidatePath(`/admin/families/${familyId}`);

  return { ok: true, familyId, familyName: family?.fullName ?? "Unknown" };
}

/**
 * Undoes a merge for one record. If the Family it belonged to has nothing
 * else linked afterward, the now-empty Family is removed too (never the
 * underlying Bill/Donation/Membership/PaymentLink itself).
 */
export async function unlinkFromFamilyAction(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as ItemKind;
  const id = String(formData.get("id") ?? "");
  const familyId = String(formData.get("familyId") ?? "");
  if (!id || !familyId) return;

  const byKind = emptyByKind();
  if (kind in byKind) byKind[kind].push(id);
  await setFamilyId(byKind, null);
  await recordAuditLog({
    action: "unlink_from_family",
    recordType: kind,
    recordId: id,
    changes: diffFields({ familyId }, { familyId: null }),
  });

  const [bills, donations, memberships, paymentLinks, formResponses, externalTransactions] = await Promise.all([
    prisma.bill.count({ where: { familyId } }),
    prisma.donation.count({ where: { familyId } }),
    prisma.membership.count({ where: { familyId } }),
    prisma.paymentLink.count({ where: { familyId } }),
    prisma.formResponse.count({ where: { familyId } }),
    prisma.externalTransaction.count({ where: { familyId } }),
  ]);
  if (bills + donations + memberships + paymentLinks + formResponses + externalTransactions === 0) {
    await prisma.family.delete({ where: { id: familyId } }).catch(() => {});
    revalidatePath("/admin/families");
    redirect("/admin/families");
  }

  revalidatePath(`/admin/families/${familyId}`);
  revalidatePath("/admin/search");
}

export type UpdateFamilyResult = { ok: true } | { ok: false; error: string };

export async function updateFamilyAction(input: {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  notes?: string;
}): Promise<UpdateFamilyResult> {
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Name is required." };

  const before = await prisma.family.findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: "Family not found." };

  const after = {
    fullName,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  await prisma.family.update({ where: { id: input.id }, data: after });
  await recordAuditLog({
    action: "edit",
    recordType: "family",
    recordId: input.id,
    changes: diffFields(before, after),
  });
  revalidatePath(`/admin/families/${input.id}`);
  revalidatePath("/admin/families");
  return { ok: true };
}

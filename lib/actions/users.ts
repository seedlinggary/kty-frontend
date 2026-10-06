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
  userId: string | null;
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
  return { ...identity, userId: response.userId };
}

async function getContactInfo(kind: ItemKind, id: string): Promise<ContactInfo | null> {
  if (kind === "bill") {
    const r = await prisma.bill.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: null, city: null, userId: r.userId } : null;
  }
  if (kind === "donation") {
    const r = await prisma.donation.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: r.address, city: r.city, userId: r.userId } : null;
  }
  if (kind === "membership") {
    const r = await prisma.membership.findUnique({ where: { id } });
    return r ? { fullName: r.fullName, email: r.email, phone: r.phone, address: r.address, city: r.city, userId: r.userId } : null;
  }
  if (kind === "formResponse") {
    return getFormResponseContactInfo(id);
  }
  if (kind === "externalTransaction") {
    const r = await prisma.externalTransaction.findUnique({ where: { id } });
    return r ? { fullName: r.clientName ?? "Unknown", email: r.email, phone: r.phone, address: null, city: null, userId: r.userId } : null;
  }
  const r = await prisma.paymentLink.findUnique({ where: { id } });
  return r ? { fullName: r.fullName ?? r.label, email: r.email, phone: r.phone, address: null, city: null, userId: r.userId } : null;
}

async function setUserId(byKind: Record<ItemKind, string[]>, userId: string | null) {
  await prisma.$transaction([
    ...(byKind.bill.length ? [prisma.bill.updateMany({ where: { id: { in: byKind.bill } }, data: { userId } })] : []),
    ...(byKind.donation.length ? [prisma.donation.updateMany({ where: { id: { in: byKind.donation } }, data: { userId } })] : []),
    ...(byKind.membership.length ? [prisma.membership.updateMany({ where: { id: { in: byKind.membership } }, data: { userId } })] : []),
    ...(byKind.paymentLink.length ? [prisma.paymentLink.updateMany({ where: { id: { in: byKind.paymentLink } }, data: { userId } })] : []),
    ...(byKind.formResponse.length ? [prisma.formResponse.updateMany({ where: { id: { in: byKind.formResponse } }, data: { userId } })] : []),
    ...(byKind.externalTransaction.length ? [prisma.externalTransaction.updateMany({ where: { id: { in: byKind.externalTransaction } }, data: { userId } })] : []),
  ]);
}

function emptyByKind(): Record<ItemKind, string[]> {
  return { bill: [], donation: [], membership: [], paymentLink: [], formResponse: [], externalTransaction: [] };
}

/**
 * Combines the checked search-result rows onto one User, so the same real
 * individual's repeated NedarimPlus signups stop showing as unrelated
 * scattered records. If some selected rows already belong to one or more
 * existing Users, those get folded together into a single one (and the
 * now-empty extras are deleted) rather than creating yet another duplicate.
 */
export async function mergeIntoUserAction(formData: FormData) {
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
  const existingUserIds = Array.from(new Set(infos.filter((i) => i?.userId).map((i) => i!.userId!)));

  let userId: string;
  if (existingUserIds.length === 0) {
    const best = infos.find((i) => i?.email && i?.phone) ?? infos.find((i) => i?.email) ?? infos[0];
    const user = await prisma.user.create({
      data: {
        fullName: best?.fullName ?? "Unknown",
        email: best?.email ?? null,
        phone: best?.phone ?? null,
        address: best?.address ?? null,
        city: best?.city ?? null,
      },
    });
    userId = user.id;
    await recordAuditLog({
      action: "merge_created_user",
      recordType: "user",
      recordId: userId,
      changes: diffFields({}, { fullName: user.fullName, email: user.email, mergedItemCount: items.length }),
    });
  } else {
    userId = existingUserIds[0];
    const otherUserIds = existingUserIds.slice(1);
    if (otherUserIds.length > 0) {
      await prisma.$transaction([
        prisma.bill.updateMany({ where: { userId: { in: otherUserIds } }, data: { userId } }),
        prisma.donation.updateMany({ where: { userId: { in: otherUserIds } }, data: { userId } }),
        prisma.membership.updateMany({ where: { userId: { in: otherUserIds } }, data: { userId } }),
        prisma.paymentLink.updateMany({ where: { userId: { in: otherUserIds } }, data: { userId } }),
        prisma.formResponse.updateMany({ where: { userId: { in: otherUserIds } }, data: { userId } }),
        prisma.externalTransaction.updateMany({ where: { userId: { in: otherUserIds } }, data: { userId } }),
      ]);
      await prisma.user.deleteMany({ where: { id: { in: otherUserIds } } });
      for (const otherUserId of otherUserIds) {
        await recordAuditLog({
          action: "merged_into_other_user",
          recordType: "user",
          recordId: otherUserId,
          changes: diffFields({ mergedInto: null }, { mergedInto: userId }),
        });
      }
    }
  }

  const byKind = emptyByKind();
  for (const item of items) byKind[item.kind].push(item.id);
  await setUserId(byKind, userId);

  for (const item of items) {
    const info = infos[items.indexOf(item)];
    if (info?.userId === userId) continue;
    await recordAuditLog({
      action: "merge_into_user",
      recordType: item.kind,
      recordId: item.id,
      changes: diffFields({ userId: info?.userId ?? null }, { userId }),
    });
  }

  revalidatePath("/admin/search");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);

  redirect(`/admin/users/${userId}`);
}

/**
 * Undoes a merge for one record. If the User it belonged to has nothing
 * else linked afterward, the now-empty User is removed too (never the
 * underlying Bill/Donation/Membership/PaymentLink itself).
 */
export async function unlinkFromUserAction(formData: FormData) {
  const kind = String(formData.get("kind") ?? "") as ItemKind;
  const id = String(formData.get("id") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!id || !userId) return;

  const byKind = emptyByKind();
  if (kind in byKind) byKind[kind].push(id);
  await setUserId(byKind, null);
  await recordAuditLog({
    action: "unlink_from_user",
    recordType: kind,
    recordId: id,
    changes: diffFields({ userId }, { userId: null }),
  });

  const [bills, donations, memberships, paymentLinks, formResponses, externalTransactions] = await Promise.all([
    prisma.bill.count({ where: { userId } }),
    prisma.donation.count({ where: { userId } }),
    prisma.membership.count({ where: { userId } }),
    prisma.paymentLink.count({ where: { userId } }),
    prisma.formResponse.count({ where: { userId } }),
    prisma.externalTransaction.count({ where: { userId } }),
  ]);
  if (bills + donations + memberships + paymentLinks + formResponses + externalTransactions === 0) {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    revalidatePath("/admin/users");
    redirect("/admin/users");
  }

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/search");
}

export type UpdateUserResult = { ok: true } | { ok: false; error: string };

export async function updateUserAction(input: {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  notes?: string;
}): Promise<UpdateUserResult> {
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Name is required." };

  const before = await prisma.user.findUnique({ where: { id: input.id } });
  if (!before) return { ok: false, error: "User not found." };

  const after = {
    fullName,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  await prisma.user.update({ where: { id: input.id }, data: after });
  await recordAuditLog({
    action: "edit",
    recordType: "user",
    recordId: input.id,
    changes: diffFields(before, after),
  });
  revalidatePath(`/admin/users/${input.id}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

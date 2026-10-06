"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth-helpers";
import { recordAuditLog } from "@/lib/audit-log";
import { shekelsToAgorot } from "@/lib/money";
import { updateKevaAmount, deleteKeva, disableKeva, enableKeva } from "@/lib/nedarim-writes";

/**
 * Real, live actions against NedarimPlus's standing-order management API -
 * genuinely still in testing (see the warnings in the UI that call these).
 * Every one of these is SUPERADMIN-gated, requires the caller to have
 * already pushed through a double confirmation, and is logged to the
 * admin audit trail with a "nedarim_" action prefix so it's visibly
 * distinct from a local-only change (see components/admin/audit-history.tsx).
 * None of these ever deletes the Membership row - only NedarimPlus's own
 * standing order can be deleted, and even then only nedarimDeletedAt is
 * set here, never the row itself.
 */

export type KevaActionResult = { ok: true } | { ok: false; error: string };

async function loadMembershipWithKeva(id: string) {
  const membership = await prisma.membership.findUnique({ where: { id } });
  if (!membership) return { ok: false as const, error: "Membership not found." };
  if (!membership.kevaId) {
    return { ok: false as const, error: "This membership has no standing order (KevaId) established yet - nothing to change on NedarimPlus." };
  }
  return { ok: true as const, membership };
}

export async function updateKevaAmountAction(input: {
  id: string;
  amountShekels: number;
  tashlumim?: number;
}): Promise<KevaActionResult> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const found = await loadMembershipWithKeva(input.id);
  if (!found.ok) return found;
  const { membership } = found;

  const result = await updateKevaAmount(membership.kevaId!, input.amountShekels, input.tashlumim);
  if (!result.ok) return { ok: false, error: `NedarimPlus rejected the update: ${result.error}` };

  const newAmountAgorot = shekelsToAgorot(input.amountShekels);
  const data: { monthlyAgorot: number; nedarimPaymentsRemaining?: number } = { monthlyAgorot: newAmountAgorot };
  if (input.tashlumim != null) data.nedarimPaymentsRemaining = input.tashlumim;

  await prisma.membership.update({ where: { id: membership.id }, data });
  await recordAuditLog({
    action: "nedarim_update_amount",
    recordType: "membership",
    recordId: membership.id,
    changes: {
      monthlyAgorot: { before: membership.monthlyAgorot, after: newAmountAgorot },
      ...(input.tashlumim != null
        ? { nedarimPaymentsRemaining: { before: membership.nedarimPaymentsRemaining, after: input.tashlumim } }
        : {}),
    },
  });

  revalidatePath("/admin/memberships");
  revalidatePath(`/admin/memberships/${membership.id}`);
  return { ok: true };
}

export async function deleteKevaAction(formData: FormData): Promise<void> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return;

  const id = String(formData.get("id") ?? "");
  const found = await loadMembershipWithKeva(id);
  if (!found.ok) return;
  const { membership } = found;

  const result = await deleteKeva(membership.kevaId!);
  if (!result.ok) {
    await recordAuditLog({
      action: "nedarim_delete_failed",
      recordType: "membership",
      recordId: membership.id,
      changes: { error: { before: null, after: result.error } },
    });
    revalidatePath(`/admin/memberships/${membership.id}`);
    return;
  }

  const now = new Date();
  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "CANCELLED", nedarimDeletedAt: now },
  });
  await recordAuditLog({
    action: "nedarim_delete",
    recordType: "membership",
    recordId: membership.id,
    changes: {
      status: { before: membership.status, after: "CANCELLED" },
      nedarimDeletedAt: { before: null, after: now },
    },
  });

  revalidatePath("/admin/memberships");
  revalidatePath(`/admin/memberships/${membership.id}`);
}

export async function disableKevaAction(formData: FormData): Promise<void> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return;

  const id = String(formData.get("id") ?? "");
  const found = await loadMembershipWithKeva(id);
  if (!found.ok) return;
  const { membership } = found;

  const result = await disableKeva(membership.kevaId!);
  if (!result.ok) {
    await recordAuditLog({
      action: "nedarim_disable_failed",
      recordType: "membership",
      recordId: membership.id,
      changes: { error: { before: null, after: result.error } },
    });
    revalidatePath(`/admin/memberships/${membership.id}`);
    return;
  }

  const now = new Date();
  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "CANCELLED", nedarimDisabledAt: now },
  });
  await recordAuditLog({
    action: "nedarim_disable",
    recordType: "membership",
    recordId: membership.id,
    changes: {
      status: { before: membership.status, after: "CANCELLED" },
      nedarimDisabledAt: { before: null, after: now },
    },
  });

  revalidatePath("/admin/memberships");
  revalidatePath(`/admin/memberships/${membership.id}`);
}

export async function enableKevaAction(formData: FormData): Promise<void> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return;

  const id = String(formData.get("id") ?? "");
  const found = await loadMembershipWithKeva(id);
  if (!found.ok) return;
  const { membership } = found;

  const result = await enableKeva(membership.kevaId!);
  if (!result.ok) {
    await recordAuditLog({
      action: "nedarim_enable_failed",
      recordType: "membership",
      recordId: membership.id,
      changes: { error: { before: null, after: result.error } },
    });
    revalidatePath(`/admin/memberships/${membership.id}`);
    return;
  }

  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: "ACTIVE", nedarimDisabledAt: null },
  });
  await recordAuditLog({
    action: "nedarim_enable",
    recordType: "membership",
    recordId: membership.id,
    changes: {
      status: { before: membership.status, after: "ACTIVE" },
      nedarimDisabledAt: { before: membership.nedarimDisabledAt, after: null },
    },
  });

  revalidatePath("/admin/memberships");
  revalidatePath(`/admin/memberships/${membership.id}`);
}

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type FieldChanges = Record<string, { before: unknown; after: unknown }>;

/** Only the fields present in `after` are compared - callers pass exactly the fields they're updating. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChanges {
  const changes: FieldChanges = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) changes[key] = { before: before[key] ?? null, after: after[key] ?? null };
  }
  return changes;
}

/**
 * Records one entry in the admin audit trail - who changed what, on which
 * record, and the before/after of every field that actually changed. A
 * no-op if nothing changed (an override save where nothing was different,
 * for instance) - an unchanged "edit" isn't worth a row. Called from a
 * webhook (no admin session) attributes to "system" rather than failing.
 */
export async function recordAuditLog(params: {
  action: string;
  recordType: string;
  recordId: string;
  changes: FieldChanges;
}): Promise<void> {
  if (Object.keys(params.changes).length === 0) return;
  const session = await auth().catch(() => null);
  await prisma.adminAuditLog.create({
    data: {
      adminEmail: session?.user?.email ?? "system",
      action: params.action,
      recordType: params.recordType,
      recordId: params.recordId,
      // Round-trips through JSON.stringify so a Date in `changes` (common -
      // comparing createdAt/nextChargeDate/etc) becomes a plain ISO string,
      // matching what Prisma's Json column type actually accepts.
      changes: JSON.parse(JSON.stringify(params.changes)),
    },
  });
}

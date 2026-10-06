import { formatAdminDateTime } from "@/lib/admin-dates";

type Entry = {
  id: string;
  adminEmail: string;
  action: string;
  changes: unknown;
  createdAt: Date;
};

const ACTION_LABELS: Record<string, string> = {
  override: "Edited (override)",
  edit: "Edited",
  cancel: "Cancelled",
  reactivate: "Reactivated",
  mark_paid: "Marked paid",
  reopen: "Reopened",
  update: "Corrected",
  delete: "Deleted",
  unexpected_charge_while_cancelled: "NedarimPlus charged this again after it was cancelled here",
  nedarim_update_amount: "Updated amount on NedarimPlus",
  nedarim_delete: "Deleted standing order on NedarimPlus",
  nedarim_delete_failed: "Tried to delete on NedarimPlus - failed",
  nedarim_disable: "Disabled standing order on NedarimPlus",
  nedarim_disable_failed: "Tried to disable on NedarimPlus - failed",
  nedarim_enable: "Re-enabled standing order on NedarimPlus",
  nedarim_enable_failed: "Tried to re-enable on NedarimPlus - failed",
  merge_created_family: "Created from a merge",
  merge_into_family: "Merged onto this family",
  merged_into_other_family: "Merged into another family",
  unlink_from_family: "Unlinked from family",
  filled_blank_fields: "Filled in from a linked form",
  resolve_follow_up: "Marked resolved",
  dismiss_follow_up: "Dismissed",
  flag_for_follow_up: "Flagged for follow-up",
  import_failure_email: "Imported from a NedarimPlus failure email",
  soft_delete: "Removed (kept, hidden)",
};

/** A "nedarim_*" action made (or tried to make) a real change on NedarimPlus's live side - never just our own records. */
function isLiveNedarimAction(action: string): boolean {
  return action.startsWith("nedarim_");
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** Shown on an edit/detail page wherever a record's change history matters - nothing here is itself editable. */
export function AuditHistory({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-line bg-white p-4">
      <h2 className="font-serif text-lg font-semibold text-ink">
        Change History <span className="text-sm font-normal text-ink/50">({entries.length})</span>
      </h2>
      <ul className="mt-3 space-y-3">
        {entries.map((entry) => {
          const changes = (entry.changes ?? {}) as Record<string, { before: unknown; after: unknown }>;
          const isLive = isLiveNedarimAction(entry.action);
          return (
            <li key={entry.id} className="border-t border-line pt-3 text-sm first:border-t-0 first:pt-0">
              <p className="text-ink/70">
                {isLive && (
                  <span className="mr-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">LIVE</span>
                )}
                <span className="font-medium text-ink">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                {" · "}
                {entry.adminEmail === "system" ? "System (NedarimPlus)" : entry.adminEmail}
                {" · "}
                {formatAdminDateTime(entry.createdAt)}
              </p>
              {Object.keys(changes).length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-ink/60">
                  {Object.entries(changes).map(([field, { before, after }]) => (
                    <li key={field}>
                      <span className="font-medium">{field}</span>: {formatValue(before)} → {formatValue(after)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import Link from "next/link";
import { mergeIntoUserAction } from "@/lib/actions/users";

const MERGE_FORM_ID = "merge-into-user";

export function UserBadge({ user }: { user: { id: string; fullName: string } | null }) {
  if (!user) return null;
  return (
    <Link
      href={`/admin/users/${user.id}`}
      className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent hover:underline"
    >
      Part of: {user.fullName}
    </Link>
  );
}

/**
 * Not nested inside MergeForm - every admin list row already has its own
 * per-row action forms (Mark Paid, Cancel, etc.), and a <form> can't legally
 * contain another <form>. The `form` attribute associates this checkbox with
 * MergeForm by id regardless of where it sits in the DOM.
 */
export function MergeCheckbox({ kind, id }: { kind: string; id: string }) {
  return (
    <input
      type="checkbox"
      name="items"
      value={`${kind}:${id}`}
      form={MERGE_FORM_ID}
      className="h-4 w-4 rounded border-line"
    />
  );
}

/**
 * A standalone form - deliberately not wrapping the table below it. Its
 * submit button and every MergeCheckbox scattered through the page's
 * table(s) reference it by id via the `form` attribute, so this can sit
 * once at the top of the page without nesting into (or around) any of the
 * per-row action forms.
 */
export function MergeForm({ redirectTo }: { redirectTo: string }) {
  return (
    <form
      id={MERGE_FORM_ID}
      action={mergeIntoUserAction}
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4"
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <p className="text-xs text-ink/50">
        Check the rows below that are the same real person - even if the name is spelled
        differently or a different email/phone was used - then combine them into one.
      </p>
      <button
        type="submit"
        className="rounded-md border border-line bg-pale px-4 py-2 text-sm font-semibold text-ink hover:bg-pale/70"
      >
        Combine Checked Rows Into One User
      </button>
    </form>
  );
}

export function MergeErrorBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      Check at least two rows before combining them into one user.
    </p>
  );
}

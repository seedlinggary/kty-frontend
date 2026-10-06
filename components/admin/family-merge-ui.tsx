"use client";

import { useTransition } from "react";
import Link from "next/link";
import { mergeIntoFamilyAction } from "@/lib/actions/families";
import { emitMergeToast } from "@/lib/merge-toast-bus";

export function FamilyBadge({ family }: { family: { id: string; fullName: string } | null }) {
  if (!family) return null;
  return (
    <Link
      href={`/admin/families/${family.id}`}
      className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent hover:underline"
    >
      Part of: {family.fullName}
    </Link>
  );
}

/**
 * Not nested inside a MergeForm - every admin list row already has its own
 * per-row action forms (Mark Paid, Cancel, etc.), and a <form> can't legally
 * contain another <form>. The `form` attribute associates this checkbox with
 * a MergeForm elsewhere on the page by id, regardless of DOM nesting.
 */
export function MergeCheckbox({ kind, id, formId = "merge-into-family" }: { kind: string; id: string; formId?: string }) {
  return (
    <input
      type="checkbox"
      name="items"
      value={`${kind}:${id}`}
      form={formId}
      className="h-4 w-4 rounded border-line"
    />
  );
}

/**
 * Calls mergeIntoFamilyAction directly (not via a <form action> bound to
 * useActionState) so a combine never navigates anywhere on its own, and
 * emits the toast synchronously the moment the result comes back - not from
 * a useEffect watching updated state. A recommendation card's own
 * MergeForm is the clearest case why: a successful merge makes that
 * recommendation stop being a duplicate, so it's gone from the list on the
 * very next render - the card (and this component instance) can unmount in
 * the very same commit that would have set the new state, before a
 * useEffect depending on that state ever gets to run. Emitting inline,
 * before React has any chance to react to the result, can't be raced by
 * that unmount.
 */
export function MergeForm({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await mergeIntoFamilyAction({ ok: null }, formData);
      if (result.ok !== null) emitMergeToast(result);
    });
  }

  return (
    <div>
      <form id={id} onSubmit={handleSubmit} className={className}>
        {children}
      </form>
      {pending && <p className="mt-2 text-sm text-ink/50">Combining…</p>}
    </div>
  );
}

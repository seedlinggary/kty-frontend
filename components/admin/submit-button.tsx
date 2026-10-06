"use client";

import { useFormStatus } from "react-dom";

/**
 * A plain one-click action button (Mark Paid, Reactivate, Resolve, Dismiss,
 * Flag Failed) that disables itself and shows `pendingLabel` while its
 * enclosing form's action is in flight - an impatient second click on a slow
 * connection re-submits the same server action instead of doing nothing,
 * which for most of these is harmless (idempotent) but still noisy
 * (duplicate audit log entries, a flash of a second email send attempt).
 * Not for anything already gated by DoubleConfirmSubmitButton, which has its
 * own click-time confirm/prompt flow this would conflict with.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-50`}>
      {pending ? pendingLabel ?? "Saving…" : children}
    </button>
  );
}

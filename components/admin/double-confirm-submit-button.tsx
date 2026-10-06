"use client";

import { useFormStatus } from "react-dom";

/**
 * For actions that are hard to casually undo (cancel, mark paid, a
 * financial override) - one confirm dialog, then a second gate that
 * requires typing a specific word rather than just clicking "OK" again, so
 * a reflexive double-click can't sail through both. Pairs with the admin
 * audit log (every one of these actions is logged with before/after), so
 * even a deliberate change is recorded, not just gated. Also disables itself
 * once confirmed and submitting, so a slow connection can't let a second
 * click (which would re-show both dialogs, easy to click through on
 * autopilot) fire the same action twice.
 */
export function DoubleConfirmSubmitButton({
  confirmMessage,
  typeToConfirm,
  children,
  className,
}: {
  confirmMessage: string;
  typeToConfirm: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-50`}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        const typed = window.prompt(`Type ${JSON.stringify(typeToConfirm)} to confirm.`);
        if (typed?.trim() !== typeToConfirm) {
          e.preventDefault();
        }
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendFollowUpEmailAction, sendAllFollowUpEmailsAction } from "@/lib/actions/payment-follow-ups";

export function SendFollowUpButton({ followUpId }: { followUpId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await sendFollowUpEmailAction(followUpId);
            if (!result.ok) setError(result.error);
            router.refresh();
          })
        }
        className="rounded bg-ink px-2 py-1 text-xs font-semibold text-white hover:bg-accent disabled:opacity-50"
      >
        {isPending ? "Sending..." : "Send Email"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SendAllFollowUpsButton({ count }: { count: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  if (count === 0) return null;

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Send a follow-up email to all ${count} open payment issues now?`)) return;
          startTransition(async () => {
            const r = await sendAllFollowUpEmailsAction();
            setResult({ sent: r.sent, failed: r.failed });
            router.refresh();
          });
        }}
        className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50"
      >
        {isPending ? "Sending..." : `Send All (${count})`}
      </button>
      {result && (
        <p className="mt-2 text-sm text-ink/60">
          Sent {result.sent}, {result.failed} skipped (no email on file, already resolved, or email send failed).
        </p>
      )}
    </div>
  );
}

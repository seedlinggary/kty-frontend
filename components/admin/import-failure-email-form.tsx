"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importFailureEmailAction } from "@/lib/actions/payment-follow-ups";
import { formatAgorotAsILS } from "@/lib/money";

const MATCH_LABELS: Record<string, string> = {
  bill: "Holiday Seats bill",
  donation: "Donation",
  membership: "Membership",
  paymentLink: "Payment Link",
  external: "Not one of ours - tracked standalone",
};

export function ImportFailureEmailForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ matched: string; name: string; amountAgorot: number | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale"
      >
        + Paste a Decline Email
      </button>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await importFailureEmailAction(text);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(r);
      setText("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-3 rounded-xl border border-line bg-white p-4">
      <p className="text-sm font-medium text-ink">Paste a NedarimPlus decline email</p>
      <p className="text-xs text-ink/50">
        Copy the full email body (the one notifying that a payment or standing order was declined)
        and paste it below. It&apos;ll be matched to the right donation/membership/bill
        automatically if it&apos;s one of ours, or tracked on its own if not.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="שלום רב, להלן פרטי..."
        dir="rtl"
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-ink/60 hover:underline"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !text.trim()}
          className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:opacity-50"
        >
          {isPending ? "Importing..." : "Import"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-900">
          Matched: {MATCH_LABELS[result.matched] ?? result.matched} — {result.name}
          {result.amountAgorot != null && ` — ${formatAgorotAsILS(result.amountAgorot)}`}
        </p>
      )}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateKevaAmountAction } from "@/lib/actions/nedarim-keva-admin";

const TESTING_WARNING =
  "⚠ This feature is still in testing. This makes a REAL change on NedarimPlus's live standing order - " +
  "it will change what actually gets charged, not just our own records.";

type Props = {
  membershipId: string;
  currentAmountShekels: number;
  currentTashlumim: number | null;
  /** NedarimPlus's last confirmed charge, if any - may differ from currentAmountShekels if someone used Edit (Override) locally before. */
  lastConfirmedShekels: number | null;
};

export function UpdateKevaAmountForm({ membershipId, currentAmountShekels, currentTashlumim, lastConfirmedShekels }: Props) {
  const router = useRouter();
  const [amountShekels, setAmountShekels] = useState(currentAmountShekels);
  const [tashlumim, setTashlumim] = useState<string>(currentTashlumim != null ? String(currentTashlumim) : "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!window.confirm(`${TESTING_WARNING}\n\nContinue?`)) return;
    const typed = window.prompt('Type "UPDATE" to confirm this real change on NedarimPlus.');
    if (typed?.trim() !== "UPDATE") return;

    startTransition(async () => {
      const result = await updateKevaAmountAction({
        id: membershipId,
        amountShekels,
        tashlumim: tashlumim.trim() === "" ? undefined : Number(tashlumim),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Updated on NedarimPlus - our own records now match.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4">
      <p className="text-xs font-medium text-red-800">{TESTING_WARNING}</p>
      {lastConfirmedShekels != null && (
        <p className="text-xs text-ink/60">
          Our records currently show ₪{currentAmountShekels}/mo. NedarimPlus&apos;s last confirmed charge was ₪
          {lastConfirmedShekels}
          {lastConfirmedShekels !== currentAmountShekels && (
            <span className="font-medium text-amber-700"> - these don&apos;t match, possibly from a local-only Edit (Override) before.</span>
          )}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink">New Amount (₪/mo)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={amountShekels}
            onChange={(e) => setAmountShekels(Number(e.target.value) || 0)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink">Payments Remaining (Tashlumim, optional)</label>
          <input
            type="number"
            min={0}
            value={tashlumim}
            onChange={(e) => setTashlumim(e.target.value)}
            placeholder="Leave blank to not change"
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3">
        {message && <span className="text-xs text-ink/70">{message}</span>}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
        >
          {isPending ? "Updating on NedarimPlus…" : "Update on NedarimPlus (Live)"}
        </button>
      </div>
    </form>
  );
}

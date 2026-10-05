"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importNedarimMembersAction } from "@/lib/actions/nedarim-import";

type Totals = { imported: number; skipped: number; paymentsImported: number };

export function ImportNedarimMembersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [done, setDone] = useState(true);

  function runFrom(startOffset: number, totals: Totals) {
    startTransition(async () => {
      let result;
      try {
        result = await importNedarimMembersAction(startOffset);
      } catch {
        // A batch itself timing out (rather than returning a clean error)
        // lands here - progress already made is safe either way, since
        // every write so far is in the database. Offset stays where it was
        // last confirmed so "Continue Import" picks up from there, not 0.
        setMessage(
          `Stopped partway through (${startOffset} checked so far) - nothing lost, click "Continue Import" to pick up from there.`
        );
        setDone(false);
        return;
      }

      if (!result.ok) {
        setMessage(result.error);
        setDone(false);
        return;
      }

      const next: Totals = {
        imported: totals.imported + result.imported,
        skipped: totals.skipped + result.skipped,
        paymentsImported: totals.paymentsImported + result.paymentsImported,
      };
      setOffset(result.processed);

      if (result.done) {
        const parts = [`Imported ${next.imported} new membership${next.imported === 1 ? "" : "s"}`];
        if (next.skipped > 0) parts.push(`${next.skipped} already on file`);
        if (next.paymentsImported > 0) {
          parts.push(`${next.paymentsImported} past payment${next.paymentsImported === 1 ? "" : "s"} filled in`);
        }
        setMessage(parts.join(" · ") + ".");
        setDone(true);
        setOffset(0);
        router.refresh();
      } else {
        setMessage(`Working... ${result.processed} of ${result.total} standing orders checked so far.`);
        setDone(false);
        runFrom(result.processed, next);
      }
    });
  }

  function handleClick() {
    setMessage(null);
    runFrom(offset, { imported: 0, skipped: 0, paymentsImported: 0 });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale disabled:opacity-50"
      >
        {isPending ? "Importing…" : done ? "Import from NedarimPlus" : `Continue Import (from ${offset})`}
      </button>
      {message && <p className="mt-2 text-sm text-ink/70">{message}</p>}
    </div>
  );
}

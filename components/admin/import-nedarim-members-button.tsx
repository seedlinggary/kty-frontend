"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importNedarimMembersAction } from "@/lib/actions/nedarim-import";

export function ImportNedarimMembersButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await importNedarimMembersAction();
      if (result.ok) {
        const parts = [`Imported ${result.imported} new membership${result.imported === 1 ? "" : "s"}`];
        if (result.skipped > 0) parts.push(`${result.skipped} already on file`);
        if (result.paymentsImported > 0) {
          parts.push(`${result.paymentsImported} past payment${result.paymentsImported === 1 ? "" : "s"} filled in`);
        }
        setMessage(parts.join(" · ") + ".");
        router.refresh();
      } else {
        setMessage(result.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-pale disabled:opacity-50"
      >
        {isPending ? "Importing…" : "Import from NedarimPlus"}
      </button>
      {message && <p className="mt-2 text-sm text-ink/70">{message}</p>}
    </div>
  );
}

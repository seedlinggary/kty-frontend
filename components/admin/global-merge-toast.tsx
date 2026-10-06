"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subscribeMergeToast, type MergeToastPayload } from "@/lib/merge-toast-bus";

/**
 * One instance, mounted once in the admin layout (never unmounts across
 * page navigation within /admin) - see merge-toast-bus.ts for why a combine
 * confirmation can't safely live in the row-level component that triggered
 * it. Fixed-position so it's never lost below the fold either.
 */
export function GlobalMergeToast() {
  const [toast, setToast] = useState<MergeToastPayload | null>(null);

  useEffect(() => subscribeMergeToast(setToast), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  if (toast.ok) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Link
          href={`/admin/families/${toast.familyId}`}
          onClick={() => setToast(null)}
          className="block rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 shadow-lg hover:bg-green-100"
        >
          Combined into {toast.familyName} - click to view →
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-lg">{toast.error}</p>
    </div>
  );
}

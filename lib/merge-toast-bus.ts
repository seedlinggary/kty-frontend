"use client";

export type MergeToastPayload = { ok: true; familyId: string; familyName: string } | { ok: false; error: string };

const EVENT_NAME = "kty-merge-toast";

/**
 * Uses a real `window` CustomEvent rather than a module-level array. A
 * plain in-module singleton (an exported `let listeners = []`) isn't
 * actually guaranteed to be one single array in Next.js App Router - the
 * layout (always-mounted) and a page deep in the tree (e.g. a row's
 * QuickCombinePicker) can end up in different route chunks, each getting
 * its own separate copy of this module, so emitting from one chunk's copy
 * never reaches a listener subscribed on another chunk's copy (confirmed:
 * this is why the first version of this fix still didn't show a toast).
 * `window` has no such ambiguity - there's exactly one of it per tab,
 * regardless of how the JS is chunked.
 */
export function emitMergeToast(payload: MergeToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MergeToastPayload>(EVENT_NAME, { detail: payload }));
}

export function subscribeMergeToast(listener: (payload: MergeToastPayload) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => listener((e as CustomEvent<MergeToastPayload>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

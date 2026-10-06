"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchCombineCandidates, type CombineCandidate } from "@/lib/actions/combine-search";
import { mergeIntoFamilyAction, type ItemKind } from "@/lib/actions/families";
import { emitMergeToast } from "@/lib/merge-toast-bus";

/**
 * Per-row "Combine with..." - search for any other record by name/email/
 * phone and combine the two immediately, without needing to go to Search
 * (or plan ahead by checking boxes on two different pages). This is the one
 * mechanism for combining two records that live on genuinely different
 * pages (a Donation and a Membership, say) - the per-page MergeCheckbox/
 * MergeForm only ever combines rows already present on that same page.
 *
 * Calls mergeIntoFamilyAction directly as a function rather than binding it
 * to a <form> - this component can itself end up nested inside another
 * MergeForm's <form> (the Search page's own cross-category merge form wraps
 * every result row), and a <form> can't legally contain another <form>.
 *
 * The result goes to the global merge-toast bus, not local state - merging
 * reassigns this row's family, which can move it into a different "grouped
 * by family" section on the next render, unmounting this exact component
 * instance before local state would ever be seen (confirmed: that's why the
 * toast never appeared here specifically, while the page-level MergeForm,
 * whose position never moves, happened to work).
 */
export function QuickCombinePicker({ kind, id, label = "Combine with…" }: { kind: ItemKind; id: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CombineCandidate[]>([]);
  const [searching, startSearch] = useTransition();
  const [pending, startCombine] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const found = await searchCombineCandidates(query, { kind, id });
        setResults(found);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, kind, id]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function pick(candidate: CombineCandidate) {
    setOpen(false);
    setQuery("");
    setResults([]);
    const formData = new FormData();
    formData.append("items", `${kind}:${id}`);
    formData.append("items", `${candidate.kind}:${candidate.id}`);
    startCombine(async () => {
      const result = await mergeIntoFamilyAction({ ok: null }, formData);
      if (result.ok !== null) emitMergeToast(result);
    });
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-ink/50 hover:underline"
      >
        {label}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 rounded-md border border-line bg-white p-2 shadow-lg">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone"
            className="w-full rounded border border-line px-2 py-1 text-xs"
          />
          {searching && <p className="mt-1 text-xs text-ink/40">Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-1 text-xs text-ink/40">No matches.</p>
          )}
          <ul className="mt-1 max-h-48 overflow-y-auto">
            {results.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <button
                  type="button"
                  onClick={() => pick(r)}
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-pale"
                >
                  {r.label}
                  {r.familyName && <span className="ml-1 text-accent">(part of {r.familyName})</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending && <p className="mt-1 text-xs text-ink/50">Combining…</p>}
    </div>
  );
}

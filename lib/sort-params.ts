export type SortDir = "asc" | "desc";

/**
 * Builds the href for a clickable sort column header: keeps every other
 * current query param (search text, status filter, grouping toggle, ...)
 * and only changes the ones in `overrides`. Shared by every admin list page
 * that sorts via SortHeader, so they all build these links the same way.
 */
export function buildSortHref(
  pathname: string,
  currentParams: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>
): string {
  const merged = { ...currentParams, ...overrides };
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) usp.set(key, value);
  }
  const qs = usp.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}

/** Clicking a column that's already active flips direction; a new column starts ascending. */
export function nextSortDir(currentSort: string, currentDir: SortDir, column: string): SortDir {
  return currentSort === column && currentDir === "asc" ? "desc" : "asc";
}

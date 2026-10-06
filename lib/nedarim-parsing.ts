/**
 * Shared, defensive parsing for raw values coming out of any NedarimPlus API
 * response or webhook payload - used by both the read-only import/re-sync
 * path (lib/actions/nedarim-import.ts) and the webhook handler
 * (app/api/webhooks/nedarimplus/route.ts), so a format quirk confirmed on one
 * path gets fixed everywhere this data enters the system, not just the place
 * it was first noticed.
 */

/**
 * NedarimPlus's JSON reports don't reliably return numeric fields as JSON
 * numbers - some (confirmed: KevaSuccess/KevaTashlumim, and webhook Amount)
 * come back as numeric strings instead (e.g. "12"), sometimes with thousands
 * separators (e.g. "1,200"). Every numeric field read from their API goes
 * through this rather than a raw strict-equality/property check or a bare
 * Number(), since `===`/`!==` don't coerce ("1" !== 1), and Number() rejects
 * a comma outright (returning NaN, not the intended value).
 */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(typeof value === "string" ? value.replace(/,/g, "") : value);
  return isNaN(n) ? null : n;
}

/**
 * NedarimPlus's date fields have shown up in more than one shape in
 * practice, so this tries each in turn rather than assuming one:
 *  - the classic ASP.NET AJAX wrapper "/Date(1700000000000)/" (their
 *    reporting backend is ASP.NET-based .aspx, where this is a very common
 *    serialization quirk for anything typed as a .NET DateTime)
 *  - "DD/MM/YYYY" or "DD/MM/YY" (confirmed in practice: GetKevaId's history
 *    dates use a 2-digit year), optionally with a trailing time portion -
 *    checked explicitly rather than left to JS's native parser, since a
 *    bare slash-separated string gets read as US-style MM/DD/YYYY, silently
 *    swapping day and month for any date where the day is 12 or under. A
 *    2-digit year is always read as 20YY - this system has no plausible
 *    transaction from the 1900s.
 *  - a raw epoch number/numeric string
 *  - ISO 8601, as a last resort via the native parser
 * Logs (not throws) when nothing matches, so a real format mismatch shows
 * up in the logs instead of silently becoming "now" or "blank" downstream.
 */
export function parseNedarimDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "string") {
    const aspNet = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    if (aspNet) {
      const d = new Date(Number(aspNet[1]));
      if (!isNaN(d.getTime())) return d;
    }

    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
    if (slash) {
      const [, d, mo, yRaw] = slash;
      const year = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
      const parsed = new Date(Date.UTC(year, Number(mo) - 1, Number(d)));
      if (!isNaN(parsed.getTime())) return parsed;
    }

    if (/^-?\d+$/.test(raw.trim())) {
      const d = new Date(Number(raw));
      if (!isNaN(d.getTime())) return d;
    }

    const iso = new Date(raw);
    if (!isNaN(iso.getTime())) return iso;
  }

  if (typeof raw === "number") {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }

  console.error("[nedarim-parsing] Unrecognized date format from NedarimPlus:", raw);
  return null;
}

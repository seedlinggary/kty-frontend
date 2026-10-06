/**
 * Builds a Prisma date-field filter from "from"/"to" query params (plain
 * YYYY-MM-DD, as sent by an <input type="date">). `to` is treated as the end
 * of that calendar day (inclusive) - a bookkeeping month-end filter like
 * "2026-01-01" to "2026-01-31" should include everything on the 31st, not
 * just up to midnight at its start.
 */
export function parseDateRangeFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const filter: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(`${from}T00:00:00.000Z`);
    if (!isNaN(d.getTime())) filter.gte = d;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999Z`);
    if (!isNaN(d.getTime())) filter.lte = d;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

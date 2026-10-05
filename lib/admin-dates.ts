/**
 * Admin-panel date display: day, short month name, year - e.g. "15 Jan
 * 2027" - deliberately never a bare numeric date. A numeric "03/05/2027"
 * reads as day-month to some people and month-day to others (exactly the
 * ambiguity that caused a real NedarimPlus date-import bug), so every date
 * shown to staff spells the month out instead of leaving it to guesswork.
 */
export function formatAdminDate(date: Date): string {
  // UTC explicitly: a date-only value here was built from a calendar day
  // with no real time-of-day (midnight UTC), so formatting in any other
  // zone risks reading back a different day depending on where this
  // renders (dev machine vs. a UTC server in production).
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatAdminDateTime(date: Date): string {
  // Unlike formatAdminDate, time-of-day here is real and meaningful, so
  // it's shown in the shul's own timezone rather than wherever the server
  // happens to run (Vercel's servers are UTC, which isn't Israel time).
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(date);
}

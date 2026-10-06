// Week math. Weeks run Monday → Sunday in the club's timezone. Dates are
// passed around as "YYYY-MM-DD" strings, which sort and compare correctly.

const dateFmtCache = new Map<string, Intl.DateTimeFormat>();

function dateFmt(tz: string) {
  let f = dateFmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFmtCache.set(tz, f);
  }
  return f;
}

/** Calendar date of an instant in a timezone, as YYYY-MM-DD. */
export function localDate(instant: Date | string | number, tz: string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  const parts = dateFmt(tz).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toUTC(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = toUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUTC(d);
}

/** 0 = Monday … 6 = Sunday */
export function dayIndex(date: string): number {
  return (toUTC(date).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `date`. */
export function weekStartOf(date: string): string {
  return addDays(date, -dayIndex(date));
}

export function weekKey(instant: Date | string | number, tz: string): string {
  return weekStartOf(localDate(instant, tz));
}

/** Offset (ms) of `tz` from UTC at a given instant. */
function tzOffset(instant: number, tz: string): number {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - Math.floor(instant / 1000) * 1000;
}

/** The instant local midnight starts on `date` in `tz`. */
export function midnightIn(date: string, tz: string): Date {
  const guess = toUTC(date).getTime();
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz); // second pass handles DST edges
  return new Date(t);
}

/** Instant the week starting `weekStart` ends (next Monday 00:00 local). */
export function weekEndsAt(weekStart: string, tz: string): Date {
  return midnightIn(addDays(weekStart, 7), tz);
}

/** ISO-8601 week number, for the "WEEK 41" eyebrow. */
export function isoWeekNumber(weekStart: string): number {
  const thursday = toUTC(addDays(weekStart, 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / 86400000 / 7) + 1;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function shortDate(date: string): string {
  const d = toUTC(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function longDate(date: string): string {
  const d = toUTC(date);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Oct 5 – 11" or "Sep 29 – Oct 5" */
export function weekRangeLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const a = toUTC(weekStart);
  const b = toUTC(end);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${shortDate(weekStart)} – ${b.getUTCDate()}`
    : `${shortDate(weekStart)} – ${shortDate(end)}`;
}

export function formatTime(instant: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
    new Date(instant),
  );
}

export function formatDateTime(instant: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(instant));
}

/** "2d 4h", "3h 12m", "8m" */
export function formatDuration(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

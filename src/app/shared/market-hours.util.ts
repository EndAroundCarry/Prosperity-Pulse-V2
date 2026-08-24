/**
 * US market hours computed client-side (cheaper and fresher than spending
 * a daily API call on MARKET_STATUS).
 *
 * All computations are in America/New_York wall-clock time. The static
 * holiday list covers NYSE closures; weekends are handled separately.
 */

export const MARKET_TIMEZONE = 'America/New_York';

/** NYSE holidays 2025–2027 (dates in New York time). Weekends excluded. */
const HOLIDAYS = new Set([
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

/** 9:30 ET regular open, 16:00 ET regular close. */
export interface MarketStatus {
  isOpen: boolean;
  /** ISO instant of the next transition (open if closed, close if open). */
  nextTransitionAt: string;
}

function nyParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts['year']),
    month: Number(parts['month']),
    day: Number(parts['day']),
    hour: Number(parts['hour']) % 24,
    minute: Number(parts['minute']),
  };
}

export function nyDateString(date: Date): string {
  const { year, month, day } = nyParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isTradingDay(date: Date): boolean {
  const dow = nyParts(date);
  const jsDow = new Date(Date.UTC(dow.year, dow.month - 1, dow.day)).getUTCDay();
  if (jsDow === 0 || jsDow === 6) return false;
  return !HOLIDAYS.has(nyDateString(date));
}

/** Minutes since ET midnight for the given instant. */
function minutesSinceEtMidnight(date: Date): number {
  const { hour, minute } = nyParts(date);
  return hour * 60 + minute;
}

function atEtMinutes(date: Date, minutes: number): Date {
  // Construct the ET wall-clock time for "today" at `minutes`, as a UTC instant.
  const { year, month, day } = nyParts(date);
  const utcGuess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  // Correct for the ET offset by re-formatting once.
  const offsetMin = etOffsetMinutes(new Date(utcGuess));
  return new Date(utcGuess + offsetMin * 60_000);
}

function etOffsetMinutes(instant: Date): number {
  // Offset of New York from UTC at the given instant, in minutes.
  const nyDate = new Date(instant.toLocaleString('en-US', { timeZone: MARKET_TIMEZONE }));
  const utcDate = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
  return (utcDate.getTime() - nyDate.getTime()) / 60_000;
}

/**
 * Pure market-status computation.
 */
export function computeMarketStatus(now: Date = new Date()): MarketStatus {
  const minutes = minutesSinceEtMidnight(now);
  const tradingToday = isTradingDay(now);

  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 16 * 60;

  if (tradingToday && minutes >= openMinutes && minutes < closeMinutes) {
    return { isOpen: true, nextTransitionAt: atEtMinutes(now, closeMinutes).toISOString() };
  }

  // Closed → find next open: today before open on a trading day, else next day.
  if (tradingToday && minutes < openMinutes) {
    return { isOpen: false, nextTransitionAt: atEtMinutes(now, openMinutes).toISOString() };
  }

  let cursor = new Date(now.getTime());
  for (let i = 0; i < 10; i++) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    if (isTradingDay(cursor)) {
      return { isOpen: false, nextTransitionAt: atEtMinutes(cursor, openMinutes).toISOString() };
    }
  }
  // Fallback (should never happen with a maintained holiday list).
  return { isOpen: false, nextTransitionAt: atEtMinutes(now, openMinutes).toISOString() };
}

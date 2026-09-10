/**
 * The small month-bucketing helper WhatsApp usage needs — deliberately NOT a
 * genericization of lib/restaurant/order-history.ts's much richer filter
 * parser (status pills, search, custom ranges). WhatsApp usage only ever
 * needs "which calendar month" and tops out at a few hundred rows per
 * restaurant per month, so a purpose-built, much smaller helper is clearer
 * than bending order-history's machinery to a second, unrelated domain.
 */

/** "YYYY-MM" for the current calendar month. */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

/** The last `count` month keys (including the current one), most recent first. */
export function recentMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < count; i++) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return keys;
}

/** "YYYY-MM" -> "September 2026". */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

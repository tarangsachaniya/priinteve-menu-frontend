import { DAY_LABELS, formatMinutes, nowInTimezone } from "@/lib/restaurant/hours";

/**
 * The owner's declared rush windows.
 *
 * Same shape and same reasoning as lib/restaurant/hours.ts — minutes from
 * midnight in the *restaurant's* timezone, and an end earlier than the start
 * means the window runs past midnight. This module imports that one's clock
 * and formatting rather than restating them, so "what time is it there" has
 * exactly one implementation.
 *
 * What peak actually does: dishes the owner flagged `demoteAtPeak` sort to the
 * end of the menu while a window is live, which puts them on the last page —
 * see lib/restaurant/menu-order.ts. Nothing here changes prices, availability
 * or whether an order can be placed. A guest is never told any of this is
 * happening, because from their side nothing has gone wrong.
 */

/** Two rushes a day is the ordinary case; the cap is a guard, not a target. */
export const MAX_PEAK_WINDOWS_PER_DAY = 6;

export type PeakWindow = {
  dayOfWeek: number;
  startsAt: number;
  endsAt: number;
  label?: string | null;
};

export type PeakState = {
  isPeak: boolean;
  /** The live window's label, or its times when unlabelled. Null when quiet. */
  label: string | null;
};

/** "12:30 pm – 2:30 pm", the fallback when the owner named no window. */
export function formatWindow(window: PeakWindow): string {
  return `${formatMinutes(window.startsAt)} – ${formatMinutes(window.endsAt)}`;
}

function describe(window: PeakWindow): string {
  return window.label?.trim() || formatWindow(window);
}

/**
 * Whether `minutes` falls inside a window that started on the same day.
 *
 * A window ending before it starts covers only the tail of its own day here;
 * the part that spills over midnight is picked up by spilledFromYesterday().
 * Zero-length windows are treated as inactive rather than as all-day: unlike
 * opening hours, where two identical times plausibly mean "always open", an
 * empty rush is a half-finished form row.
 */
function withinWindow(window: PeakWindow, minutes: number): boolean {
  if (window.endsAt > window.startsAt) {
    return minutes >= window.startsAt && minutes < window.endsAt;
  }
  if (window.endsAt < window.startsAt) return minutes >= window.startsAt;
  return false;
}

/** Yesterday's late window still running into the small hours of today. */
function spilledFromYesterday(window: PeakWindow, minutes: number): boolean {
  return window.endsAt < window.startsAt && minutes < window.endsAt;
}

/**
 * Is the restaurant in a rush right now?
 *
 * No windows means no — see the note on the RestaurantPeakWindow model for why
 * that default has to be the quiet one.
 */
export function resolvePeakState({
  windows,
  timezone,
  now = new Date(),
}: {
  windows: PeakWindow[];
  timezone: string;
  now?: Date;
}): PeakState {
  if (windows.length === 0) return { isPeak: false, label: null };

  const { dayOfWeek, minutes } = nowInTimezone(timezone, now);
  const yesterday = (dayOfWeek + 6) % 7;

  for (const window of windows) {
    if (window.dayOfWeek === dayOfWeek && withinWindow(window, minutes)) {
      return { isPeak: true, label: describe(window) };
    }
    if (window.dayOfWeek === yesterday && spilledFromYesterday(window, minutes)) {
      return { isPeak: true, label: describe(window) };
    }
  }

  return { isPeak: false, label: null };
}

/**
 * A sensible pair to start from, offered when an owner adds their first rush
 * to a day — lunch and dinner, which is what nearly every kitchen means.
 */
export function defaultPeakWindows(dayOfWeek: number): PeakWindow[] {
  return [
    { dayOfWeek, startsAt: 750, endsAt: 870, label: "Lunch rush" }, // 12:30–14:30
    { dayOfWeek, startsAt: 1170, endsAt: 1350, label: "Dinner rush" }, // 19:30–22:30
  ];
}

/** Groups a flat list into seven day buckets, for the owner's editor. */
export function groupByDay(windows: PeakWindow[]): PeakWindow[][] {
  return DAY_LABELS.map((_, dayOfWeek) =>
    windows
      .filter((window) => window.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startsAt - b.startsAt)
  );
}

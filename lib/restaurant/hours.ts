/**
 * Opening hours for the restaurant template.
 *
 * Pure functions, no database and no React: the same code decides what the
 * customer's "Open now" badge says, and decides server-side whether an order
 * may be placed at all. Those two must never disagree — a guest who sees
 * "Open" and then gets rejected at checkout blames the restaurant.
 *
 * Two design points worth stating, because both are easy to get wrong:
 *
 *   1. Times are minutes from midnight in the *restaurant's* timezone, not the
 *      visitor's. A guest whose phone is on London time scanning a QR code in
 *      Bandra must see Bandra's opening hours.
 *   2. closesAt may be smaller than opensAt. That is not bad data, it is a
 *      kitchen that runs 18:00 → 01:00, and it is common enough that treating
 *      it as an error would break real restaurants.
 *
 * Three things this module must never do, each of which has caused a
 * restaurant to read "Open" while its kitchen was dark:
 *
 *   - read the server's local clock. A container on UTC and a laptop on IST
 *     must agree, so every wall-clock read goes through nowInTimezone().
 *   - read the visitor's clock. The badge is about the kitchen, not the phone.
 *   - trust the stored zone blindly. An empty or misspelt Restaurant.timezone
 *     resolves to DEFAULT_TIMEZONE rather than to whatever the host is set to.
 */

/** Sunday-first, matching JavaScript's Date.getDay(). */
export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const MINUTES_PER_DAY = 24 * 60;

/**
 * India Standard Time, and the only zone this platform actually serves today.
 *
 * Restaurant.timezone still decides — a tenant outside India stays correct
 * without a code change — but anything missing, empty or unparseable resolves
 * here rather than to the host's local zone, which is the failure that let a
 * UTC container report an 11pm-IST kitchen as open.
 */
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export type DayHours = {
  dayOfWeek: number;
  opensAt: number;
  closesAt: number;
  isClosed: boolean;
};

export type OpenState = {
  isOpen: boolean;
  /** Why the restaurant is shut, when it is. Null while open. */
  reason: "hours" | "paused" | "inactive" | null;
  /** Ready-to-render line: "Open until 11:00 pm" / "Opens Tuesday 10:00 am". */
  label: string;
};

/** 570 → "9:30 am". Minutes past 24h wrap, so 1500 reads as "1:00 am". */
export function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const suffix = hour24 < 12 ? "am" : "pm";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

/** "09:30" → 570. Returns null for anything that isn't a valid time of day. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 570 → "09:30", the value an <input type="time"> expects. */
export function formatMinutesForInput(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${Math.floor(wrapped / 60)
    .toString()
    .padStart(2, "0")}:${(wrapped % 60).toString().padStart(2, "0")}`;
}

/**
 * The zone a restaurant's hours are read in.
 *
 * Anything the runtime cannot resolve — unset, blank, a typo, a Windows zone
 * name — becomes DEFAULT_TIMEZONE. Returning the input unchecked is what let a
 * bad value fall through to the host clock further down.
 */
export function resolveTimezone(timezone: string | null | undefined): string {
  const candidate = timezone?.trim();
  if (!candidate) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * The weekday and minute-of-day it currently is where the restaurant is.
 *
 * Intl is the whole implementation on purpose. Doing this with UTC offset
 * arithmetic means hardcoding +05:30, which is wrong the moment a tenant is
 * created outside India and silently wrong during any DST transition.
 *
 * The weekday is derived from the formatted calendar date rather than from a
 * localised weekday token. That is not pedantry: the previous version matched
 * Intl's "Mon"/"Tue" strings against an English table and fell back to
 * `now.getDay()` — the *server's* weekday — whenever the match failed, so a
 * runtime that spelled the day differently silently reintroduced host-local
 * time. Date.UTC() over the zone's own y/m/d has no such escape hatch.
 */
export function nowInTimezone(
  timezone: string,
  now: Date = new Date()
): { dayOfWeek: number; minutes: number } {
  const zone = resolveTimezone(timezone);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // "24" is a legal formatToParts result for midnight under hour12:false.
  const hour = lookup("hour") % 24;

  return {
    dayOfWeek: new Date(Date.UTC(lookup("year"), lookup("month") - 1, lookup("day"))).getUTCDay(),
    minutes: hour * 60 + lookup("minute"),
  };
}

function dayFor(hours: DayHours[], dayOfWeek: number): DayHours | null {
  return hours.find((entry) => entry.dayOfWeek === dayOfWeek) ?? null;
}

/** True when `minutes` falls inside a shift, handling the past-midnight case. */
function withinShift(day: DayHours, minutes: number): boolean {
  if (day.isClosed) return false;
  if (day.closesAt > day.opensAt) return minutes >= day.opensAt && minutes < day.closesAt;
  // Overnight: 18:00 → 01:00 covers 18:00–23:59 of this day.
  if (day.closesAt < day.opensAt) return minutes >= day.opensAt;
  // opensAt === closesAt is treated as open all day, which is what an owner
  // who typed the same time twice almost certainly meant.
  return true;
}

/** Whether yesterday's overnight shift is still running into today. */
function spilledFromYesterday(hours: DayHours[], dayOfWeek: number, minutes: number): boolean {
  const yesterday = dayFor(hours, (dayOfWeek + 6) % 7);
  if (!yesterday || yesterday.isClosed) return false;
  return yesterday.closesAt < yesterday.opensAt && minutes < yesterday.closesAt;
}

/** The next day that has any opening at all, searching forward up to a week. */
function nextOpening(hours: DayHours[], fromDay: number): { day: DayHours; offset: number } | null {
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = dayFor(hours, (fromDay + offset) % 7);
    if (day && !day.isClosed) return { day, offset };
  }
  return null;
}

/**
 * The single answer to "can this restaurant take an order right now".
 *
 * Precedence, most decisive first: the platform switch (isActive), the owner's
 * manual pause, then the weekly schedule. A restaurant with no hours rows is
 * open — see the note on the RestaurantHours model for why that default is
 * deliberate rather than lazy. Provisioning writes a default week so that
 * fallback is a genuine edge case rather than the state most tenants are in.
 *
 * Prefer resolveAvailability(), which cannot be called with a field missing.
 */
export function resolveOpenState({
  hours,
  timezone,
  isActive = true,
  acceptingOrders = true,
  closedMessage,
  now = new Date(),
}: {
  hours: DayHours[];
  timezone: string;
  isActive?: boolean;
  acceptingOrders?: boolean;
  closedMessage?: string | null;
  now?: Date;
}): OpenState {
  if (!isActive) {
    return { isOpen: false, reason: "inactive", label: "Not accepting orders" };
  }

  if (!acceptingOrders) {
    return {
      isOpen: false,
      reason: "paused",
      label: closedMessage?.trim() || "Temporarily closed",
    };
  }

  if (hours.length === 0) {
    return { isOpen: true, reason: null, label: "Open now" };
  }

  const { dayOfWeek, minutes } = nowInTimezone(timezone, now);
  const today = dayFor(hours, dayOfWeek);

  if (spilledFromYesterday(hours, dayOfWeek, minutes)) {
    const yesterday = dayFor(hours, (dayOfWeek + 6) % 7)!;
    return { isOpen: true, reason: null, label: `Open until ${formatMinutes(yesterday.closesAt)}` };
  }

  if (today && withinShift(today, minutes)) {
    return { isOpen: true, reason: null, label: `Open until ${formatMinutes(today.closesAt)}` };
  }

  // Closed. Say when it opens again, which is the only useful thing to say.
  if (today && !today.isClosed && minutes < today.opensAt) {
    return { isOpen: false, reason: "hours", label: `Opens today at ${formatMinutes(today.opensAt)}` };
  }

  const upcoming = nextOpening(hours, dayOfWeek);
  if (!upcoming) {
    return { isOpen: false, reason: "hours", label: "Closed" };
  }

  const dayName =
    upcoming.offset === 1 ? "tomorrow" : DAY_LABELS[upcoming.day.dayOfWeek];
  return {
    isOpen: false,
    reason: "hours",
    label: `Opens ${dayName} at ${formatMinutes(upcoming.day.opensAt)}`,
  };
}

/** Seven rows of sensible defaults, for a restaurant that has never set hours. */
export function defaultWeek(): DayHours[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt: 600,
    closesAt: 1380,
    isClosed: false,
  }));
}

/**
 * The fields any surface needs in order to be told whether a restaurant is
 * open. Deliberately the exact column names on Restaurant plus its `hours`
 * relation, so a caller can hand over a row without reshaping it.
 */
export type AvailabilityInput = {
  hours: DayHours[];
  timezone: string | null | undefined;
  isActive?: boolean;
  acceptingOrders?: boolean;
  closedMessage?: string | null;
};

/**
 * THE entry point for "is this restaurant open".
 *
 * resolveOpenState() takes five loose arguments, and every caller that forgot
 * one — `isActive`, most often — got a silently wrong answer that defaulted to
 * open. This takes the restaurant instead, so the menu page, the order route,
 * the admin list and the owner's preview cannot drift apart by omission.
 *
 * Everything that reports availability calls this. Nothing calls
 * resolveOpenState() directly except this function.
 */
export function resolveAvailability(input: AvailabilityInput, now: Date = new Date()): OpenState {
  return resolveOpenState({
    hours: input.hours,
    timezone: resolveTimezone(input.timezone),
    isActive: input.isActive,
    acceptingOrders: input.acceptingOrders,
    closedMessage: input.closedMessage,
    now,
  });
}

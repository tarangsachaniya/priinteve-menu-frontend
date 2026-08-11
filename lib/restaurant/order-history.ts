import type { RestoOrderStatus } from "@/lib/api/enums";

/**
 * Filters for the staff order history — the client-facing subset of the
 * monolith's lib/restaurant/order-history.ts. The Prisma-backed query
 * builders (buildHistoryWhere, buildHistoryOrderBy, buildSearchWhere,
 * csvCell/csvRow, historyQuery's server sibling) stayed on the API, which
 * now runs GET /api/restaurant/orders/history and GET
 * /api/restaurant/orders/export with its own copy of this file. This copy
 * exists so the history page (a server component that no longer touches
 * Prisma) can parse ?query params the same way the API does, and so
 * historyQuery() can build shareable/paginated links client-side.
 *
 * Every parser here falls back rather than throwing: a hand-edited query
 * string should show the default range, not a 500.
 */

/** Default rows per page; the length menu can override it per request. */
export const HISTORY_PAGE_SIZE = 25;

export const HISTORY_PAGE_SIZES = [10, 25, 50, 100];

/** Sortable columns, as a whitelist — also enforced server-side. */
export const HISTORY_SORTS = [
  "orderNumber",
  "placedAt",
  "customerName",
  "type",
  "status",
  "paymentStatus",
  "total",
] as const;

export type HistorySort = (typeof HISTORY_SORTS)[number];

export type SortDirection = "asc" | "desc";

/**
 * Longer than any real name or dish; a cap keeps a pasted essay out of the
 * search. The input enforces the same limit, so what the box holds and what
 * the server searched for can never disagree.
 */
export const HISTORY_SEARCH_MAX_LENGTH = 80;

export type HistoryStatus = "all" | RestoOrderStatus;

export type HistoryPreset = "today" | "7d" | "month" | "custom";

export const HISTORY_PRESETS: { key: HistoryPreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

export const HISTORY_STATUSES: { key: HistoryStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export type HistoryFilters = {
  preset: HistoryPreset;
  /** Inclusive start instant. */
  from: Date;
  /** Exclusive end instant. */
  to: Date;
  /** The yyyy-mm-dd strings the date inputs render, in restaurant time. */
  fromDate: string;
  toDate: string;
  status: HistoryStatus;
  menuItemId: string | null;
  /** Free-text search across order number, customer, mobile and dish names. */
  q: string;
  sort: HistorySort;
  dir: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The calendar date it currently is *at the restaurant*, as yyyy-mm-dd.
 *
 * Reading the date off a bare Date in a UTC-hosted process would put an IST
 * restaurant five and a half hours behind its own clock — orders placed late
 * evening would be filed under tomorrow, which on a page an owner
 * reconciles takings against is a wrong number, not a cosmetic one.
 */
function todayInZone(timezone: string, now: Date = new Date()): string {
  // en-CA formats as yyyy-mm-dd, which is the format the date input wants.
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
}

/**
 * How far the named zone sits from UTC at a given instant, in minutes.
 *
 * Derived by formatting the instant in that zone and reading the clock back,
 * rather than hardcoding +5:30 — a restaurant may set any IANA zone, and some
 * of them observe DST.
 */
function zoneOffsetMinutes(timezone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000;
}

/** Midnight at the start of a yyyy-mm-dd calendar date in the given zone. */
function startOfDayInZone(date: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const naive = Date.UTC(year, month - 1, day);
  // Two passes: the first offset is read at the wrong instant when the guess
  // lands on the far side of a DST change, the second corrects it.
  const first = new Date(naive - zoneOffsetMinutes(timezone, new Date(naive)) * 60_000);
  return new Date(naive - zoneOffsetMinutes(timezone, first) * 60_000);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function isCalendarDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parsePreset(value: string | undefined): HistoryPreset {
  return HISTORY_PRESETS.some((p) => p.key === value) ? (value as HistoryPreset) : "7d";
}

function parseStatus(value: string | undefined): HistoryStatus {
  return HISTORY_STATUSES.some((s) => s.key === value) ? (value as HistoryStatus) : "all";
}

function parseSort(value: string | undefined): HistorySort {
  return HISTORY_SORTS.includes(value as HistorySort) ? (value as HistorySort) : "placedAt";
}

function parseDir(value: string | undefined): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

function parsePageSize(value: string | undefined): number {
  const size = Number(value);
  return HISTORY_PAGE_SIZES.includes(size) ? size : HISTORY_PAGE_SIZE;
}

export type HistorySearchParams = {
  preset?: string;
  from?: string;
  to?: string;
  status?: string;
  menuItemId?: string;
  q?: string;
  sort?: string;
  dir?: string;
  page?: string;
  pageSize?: string;
};

export function parseHistoryFilters(searchParams: HistorySearchParams, timezone: string): HistoryFilters {
  const today = todayInZone(timezone);

  // An explicit from/to always means a custom range, even without ?preset=,
  // so a hand-built or shared link behaves the way it reads.
  const hasCustomDates = isCalendarDate(searchParams.from) || isCalendarDate(searchParams.to);
  const preset = hasCustomDates ? "custom" : parsePreset(searchParams.preset);

  let fromDate: string;
  let toDate: string;

  if (preset === "custom") {
    fromDate = isCalendarDate(searchParams.from) ? searchParams.from : today;
    toDate = isCalendarDate(searchParams.to) ? searchParams.to : today;
    // A backwards range is a slip, not an error worth blocking on.
    if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
  } else if (preset === "today") {
    fromDate = today;
    toDate = today;
  } else if (preset === "month") {
    fromDate = `${today.slice(0, 7)}-01`;
    toDate = today;
  } else {
    fromDate = addDays(today, -6);
    toDate = today;
  }

  const pageRaw = Number(searchParams.page);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  return {
    preset,
    from: startOfDayInZone(fromDate, timezone),
    // Exclusive: the day after `toDate` starts, so the whole of `toDate` counts.
    to: startOfDayInZone(addDays(toDate, 1), timezone),
    fromDate,
    toDate,
    status: parseStatus(searchParams.status),
    menuItemId: searchParams.menuItemId || null,
    q: (searchParams.q ?? "").trim().slice(0, HISTORY_SEARCH_MAX_LENGTH),
    sort: parseSort(searchParams.sort),
    dir: parseDir(searchParams.dir),
    page,
    pageSize: parsePageSize(searchParams.pageSize),
  };
}

/** Rebuilds the query string, dropping empties so shared links stay readable. */
export function historyQuery(
  filters: HistoryFilters,
  overrides: Partial<Record<keyof HistorySearchParams, string | null>> = {},
): string {
  const base: Record<string, string> = {
    preset: filters.preset,
    status: filters.status,
    ...(filters.preset === "custom" ? { from: filters.fromDate, to: filters.toDate } : {}),
    ...(filters.menuItemId ? { menuItemId: filters.menuItemId } : {}),
    ...(filters.q ? { q: filters.q } : {}),
    // Defaults stay out of the URL, so an untouched table still shares as a
    // clean link rather than one carrying every implicit setting.
    ...(filters.sort === "placedAt" && filters.dir === "desc" ? {} : { sort: filters.sort, dir: filters.dir }),
    ...(filters.pageSize === HISTORY_PAGE_SIZE ? {} : { pageSize: String(filters.pageSize) }),
    ...(filters.page > 1 ? { page: String(filters.page) } : {}),
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") delete base[key];
    else base[key] = value;
  }

  return new URLSearchParams(base).toString();
}

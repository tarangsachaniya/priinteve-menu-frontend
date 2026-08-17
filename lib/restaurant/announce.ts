import { enqueueAnnouncement } from "@/lib/restaurant/announce-queue";

/**
 * Speaks a ready order's number aloud, for a guest who is not looking at the
 * wall the moment their number moves column. The chime says "something is
 * ready"; this says which number, so nobody has to walk over and check.
 *
 * Names the order when a first name is available (the pickup board's own API
 * response — see PickupOrder.customerName in pickup-display.tsx) — the
 * server only ever gives out a first name, never the full one, so that's the
 * most this ever speaks.
 *
 * ─── Where the work actually happens ────────────────────────────────────────
 *
 * This file is now only the vocabulary: the language list, and the one function
 * the two call sites use. Two things moved out of it:
 *
 *   lib/restaurant/tts/          which provider speaks — the device's own voice
 *                                where one is installed, Sarvam where it isn't.
 *                                English never reaches Sarvam.
 *   lib/restaurant/announce-queue.ts
 *                                ordering, deduplication, the cap, timeouts,
 *                                and the waiting track that covers the gap
 *                                while speech is being prepared.
 *
 * Both were previously a single chained promise and a hardcoded Sarvam fetch
 * living here. Splitting them is what made "add a provider" and "don't announce
 * the same order twice" separate, small changes rather than one tangled one.
 *
 * BEST EFFORT, by design. A provider outage, an unconfigured key or a device
 * with no voice means that one announcement is skipped — the visual flash and
 * the chime are independent of speech and keep working regardless.
 */

/**
 * Every language the pickup board and order-status page can announce in —
 * the single source of truth for both the type below and the Settings
 * picker (screen-settings.tsx imports this list directly rather than
 * keeping its own copy). Must mirror announceLanguageEnum in priinteve-api's
 * validations/restaurant.ts exactly: that's the real ceiling, since it's
 * every language Sarvam's Bulbul v3 voice can actually speak — see
 * services/integrations/sarvam.ts over there for why "any language" still
 * stops at eleven.
 *
 * A device with its own installed voice for one of these speaks it locally and
 * never touches Sarvam, but the LIST is still bounded by what Sarvam can cover,
 * because that is the fallback every device must be able to reach.
 */
export const ANNOUNCE_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "gu", label: "Gujarati" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "pa", label: "Punjabi" },
  { code: "od", label: "Odia" },
] as const;

export type AnnounceLanguage = (typeof ANNOUNCE_LANGUAGES)[number]["code"];

export type ReadyAnnouncement = {
  /**
   * Stable identity for THIS ready event, used by the queue to reject a repeat
   * of it. The pickup board has no order id in its payload — deliberately, it
   * is a public wall display — so it passes the order number, which is unique
   * within the day the queue's dedupe window covers.
   */
  id: string;
  orderNumber: number;
  name?: string;
};

function isKnownLanguage(lang: string): lang is AnnounceLanguage {
  return ANNOUNCE_LANGUAGES.some((l) => l.code === lang);
}

/**
 * Queues each newly-ready order to be spoken once per enabled language, in the
 * order the restaurant configured (see screen-settings.tsx's reorder controls).
 *
 * Fire-and-forget: returns void and callers do not await it.
 *
 * Announcements never overlap and never run in parallel — the queue plays one
 * to completion before starting the next, whichever provider speaks it.
 */
export function announceReady(orders: ReadyAnnouncement[], languages: AnnounceLanguage[]): void {
  if (orders.length === 0) return;

  /**
   * A language code this board doesn't know would make the announcement URLs
   * nonsensical. The caller polls inside a try/catch that counts throws as
   * failed polls, so a bad row in the database must not turn into one — skip it
   * instead, same reasoning the original code had for this filter.
   */
  const known = languages.filter(isKnownLanguage);
  if (known.length === 0) return;

  for (const order of orders) {
    enqueueAnnouncement({
      orderId: order.id,
      orderNumber: order.orderNumber,
      name: order.name,
      languages: known,
    });
  }
}

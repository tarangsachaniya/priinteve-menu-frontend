/**
 * Speaks a ready order's number aloud, for a guest who is not looking at the
 * wall the moment their number moves column. The chime says "something is
 * ready"; this says which number, so nobody has to walk over and check.
 *
 * Names the order when a first name is available (the pickup board's own API
 * response — see PickupOrder.customerName in pickup-display.tsx) — the
 * server only ever gives out a first name, never the full one, so that's the
 * most this ever speaks. Omitted, the clip falls back to the plain "order N
 * is ready" phrase. See PHRASE_FOR in priinteve-api's
 * services/integrations/sarvam.ts for exactly which languages speak the name.
 *
 * Server-generated speech (Sarvam AI Bulbul v3), not the browser's
 * speechSynthesis — Windows ships no Hindi/Gujarati voice out of the box,
 * which used to leave boards on PCs silently speaking English only, with no
 * way to fix it short of installing an OS voice pack. See priinteve-api's
 * services/integrations/sarvam.ts for the phrase text and the Sarvam call;
 * this file only fetches and plays the resulting clip.
 *
 * NO FALLBACK, by design. If /api/order/announce-audio is unconfigured or a
 * request fails, that one announcement is simply skipped — same best-effort
 * philosophy as the chime in chime.ts. The visual flash and the chime are
 * both independent of speech and keep working regardless.
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

export type ReadyAnnouncement = { orderNumber: number; name?: string };

function isKnownLanguage(lang: string): lang is AnnounceLanguage {
  return ANNOUNCE_LANGUAGES.some((l) => l.code === lang);
}

/**
 * Relative path only, never an absolute URL to the API host — every
 * browser-originated request in this app goes through the Next proxy at
 * app/api/[...path]/route.ts, same rule lib/restaurant/screen-paths.ts
 * follows for the mounted-screen endpoints.
 */
function announceAudioPath(lang: AnnounceLanguage, orderNumber: number, name?: string): string {
  const base = `/api/order/announce-audio?lang=${lang}&orderNumber=${orderNumber}`;
  return name ? `${base}&name=${encodeURIComponent(name)}` : base;
}

/**
 * One <audio> element, reused for every clip rather than created per-play.
 * Module-scoped so the sequential queue below and the element itself always
 * agree on what is currently playing.
 */
let sharedAudio: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

/**
 * Plays exactly one clip to completion, or resolves immediately on any
 * failure — a non-2xx from the endpoint, a network error, or the browser
 * refusing autoplay. Never rejects: a missing clip must never surface as a
 * thrown error to announceReady's caller, same as the speechSynthesis code
 * this replaces never threw for a missing voice.
 *
 * `onStart`, when given, fires on the "playing" event — audible start, not
 * just a resolved play() promise, which can land before the browser has
 * actually produced sound. See announceReady's doc comment for why a caller
 * wants this.
 */
function playClip(lang: AnnounceLanguage, orderNumber: number, name?: string, onStart?: () => void): Promise<void> {
  const audio = getAudioElement();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      audio.removeEventListener("playing", onPlaying);
      resolve();
    };
    const onPlaying = () => onStart?.();
    if (onStart) audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
    audio.src = announceAudioPath(lang, orderNumber, name);
    audio.play().catch(finish);
  });
}

/**
 * Serializes every announceReady() call — across separate invocations, not
 * just within one — onto a single queue, so two poll ticks landing close
 * together chain their clips on the one shared <audio> element instead of
 * talking over each other.
 */
let queue: Promise<void> = Promise.resolve();

/**
 * Speaks each newly-ready order once per enabled language, in the order the
 * restaurant configured (see screen-settings.tsx's reorder controls).
 *
 * Fire-and-forget: this returns void and callers do not await it, exactly
 * matching the old speechSynthesis-based signature so neither call site
 * (pickup-display.tsx, order-status-tracker.tsx) needed to change.
 *
 * `onFirstClipStart`, when given, fires once — the moment the very first
 * clip in this batch is actually audible. This exists so a caller that also
 * plays a secondary, near-instant sound (pickup-display.tsx's chime, which
 * is synthesized locally and needs no network round trip) can hold that
 * sound back until the announcement itself has started, rather than the
 * quick local sound winning the race against a clip that still has to be
 * fetched. Never fires at all if every clip in the batch fails to play —
 * callers that need a sound regardless should pair this with their own
 * timeout as a fallback.
 */
export function announceReady(
  orders: ReadyAnnouncement[],
  languages: AnnounceLanguage[],
  onFirstClipStart?: () => void,
): void {
  if (orders.length === 0) return;
  if (typeof window === "undefined") return;

  /**
   * A language code this board doesn't know would make announceAudioPath
   * build a nonsensical URL. The caller polls inside a try/catch that counts
   * throws as failed polls, so a bad row in the database must not turn into
   * one — skip it instead, same reasoning the old code had for this filter.
   */
  const known = languages.filter(isKnownLanguage);
  if (known.length === 0) return;

  queue = queue.then(async () => {
    let firstClip = true;
    for (const order of orders) {
      for (const lang of known) {
        await playClip(lang, order.orderNumber, order.name, firstClip ? onFirstClipStart : undefined);
        firstClip = false;
      }
    }
  });
}

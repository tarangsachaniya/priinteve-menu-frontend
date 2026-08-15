/**
 * Speaks a ready order's number aloud, for a guest who is not looking at the
 * wall the moment their number moves column. The chime says "something is
 * ready"; this says which number, so nobody has to walk over and check.
 *
 * NO NAMES. The board does not receive one and this must never speak one — a
 * lobby speaker calling out who is waiting is a different thing from a screen
 * showing a number, and the number on the guest's receipt already identifies
 * them.
 *
 * Best-effort like the chime in chime.ts: an unsupported browser or a refusal
 * to speak must not break the board, just leave it relying on the flash and
 * the chime alone.
 */

export type AnnounceLanguage = "en" | "hi" | "gu";

export type ReadyAnnouncement = { orderNumber: number };

const BCP47: Record<AnnounceLanguage, string> = {
  en: "en-IN",
  hi: "hi-IN",
  gu: "gu-IN",
};

/**
 * One order per phrase, so nothing here ever has to compose a list — there is
 * no plural case in any language once each sentence names exactly one order.
 *
 * Written as spoken sentences, not as translations of the English one. The
 * earlier wording was a word-for-word calque that said "के लिए" twice in one
 * breath and used "पिकअप" — the English word in Devanagari letters — for a
 * concept Hindi and Gujarati both have perfectly good verbs for.
 *
 * The number stays in Latin digits deliberately: hi-IN and gu-IN voices read
 * "42" correctly as bayālīs / betāḷīs, while Devanagari and Gujarati numerals
 * are read inconsistently and some engines spell them out digit by digit.
 */
const PHRASE_FOR: Record<AnnounceLanguage, (order: ReadyAnnouncement) => string> = {
  en: (order) => `Order number ${order.orderNumber} is ready. Please collect it.`,
  hi: (order) => `ऑर्डर नंबर ${order.orderNumber} तैयार है, कृपया ले जाएँ।`,
  gu: (order) => `ઓર્ડર નંબર ${order.orderNumber} તૈયાર છે, કૃપા કરીને લઈ જાઓ.`,
};

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) cachedVoices = voices;
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  refreshVoices();
  // Chrome (among others) loads its voice list asynchronously — a call made
  // before this fires can come back empty even though voices exist a tick
  // later. Refreshing here means the first announcement after page load
  // still gets a real voice instead of silently landing on the browser's
  // default for that language.
  window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
}

/**
 * Best installed voice for a language, or undefined when the device has none.
 *
 * Exact BCP-47 match first (e.g. "hi-IN"), then same base language ignoring
 * region (any "hi-*"), since a device with "hi-IN" specifically unavailable
 * but some other Hindi locale installed should still get real Hindi.
 *
 * Exported for the voice-check panel in screen-settings.tsx, so the owner's
 * "is Hindi installed?" readout and the board's actual choice can never
 * disagree about what counts as installed.
 */
export function bestVoice(lang: AnnounceLanguage): SpeechSynthesisVoice | undefined {
  const bcp47 = BCP47[lang].toLowerCase();
  const base = bcp47.split("-")[0];
  return (
    cachedVoices.find((v) => v.lang.toLowerCase() === bcp47) ??
    cachedVoices.find((v) => v.lang.toLowerCase().startsWith(`${base}-`) || v.lang.toLowerCase() === base)
  );
}

/** Whether this device can actually speak a language, for the settings readout. */
export function hasVoiceFor(lang: AnnounceLanguage): boolean {
  return bestVoice(lang) !== undefined;
}

function isKnownLanguage(lang: string): lang is AnnounceLanguage {
  return lang === "en" || lang === "hi" || lang === "gu";
}

/**
 * Speaks each newly-ready order once per enabled language, in the order the
 * restaurant configured (see screen-settings.tsx's reorder controls).
 * speechSynthesis queues utterances rather than overlapping them, so multiple
 * orders and multiple languages chain into one queue rather than talking over
 * each other.
 */
export function announceReady(orders: ReadyAnnouncement[], languages: AnnounceLanguage[]): void {
  if (orders.length === 0) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  /**
   * A language code the board does not know would make PHRASE_FOR[lang]
   * undefined and throw. The caller polls inside a try/catch that counts
   * throws as failed polls, so one bad row in the database would park the
   * board on a permanent, untrue "Reconnecting…" while the orders themselves
   * were arriving fine. Skip it instead.
   */
  const known = languages.filter(isKnownLanguage);

  /**
   * The device may have no voice for a language — a Windows PC ships none for
   * Hindi or Gujarati until someone installs them, which is why a board that
   * works on an Android tablet can be silent or garbled on a PC. Handing a
   * Devanagari string to an English voice produces noise, not Hindi, so speak
   * the English phrase instead and let the settings panel tell the owner what
   * to install. Deduped, so two missing languages do not say it twice.
   */
  const speakable: AnnounceLanguage[] = [];
  let needsEnglishFallback = false;
  for (const lang of known) {
    if (bestVoice(lang)) speakable.push(lang);
    else needsEnglishFallback = true;
  }
  if (needsEnglishFallback && !speakable.includes("en")) speakable.push("en");
  if (speakable.length === 0) return;

  for (const order of orders) {
    for (const lang of speakable) {
      const utterance = new SpeechSynthesisUtterance(PHRASE_FOR[lang](order));
      utterance.lang = BCP47[lang];
      utterance.rate = 0.95;
      const voice = bestVoice(lang);
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    }
  }
}

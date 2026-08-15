/**
 * Speaks a ready order's number and guest name aloud, for a guest who is not
 * looking at the wall the moment their number moves column. The chime says
 * "something is ready"; this says which one and for whom, so nobody has to
 * walk over and check.
 *
 * Best-effort like the chime in chime.ts: an unsupported browser or a refusal
 * to speak must not break the board, just leave it relying on the flash and
 * the chime alone. A missing voice for Hindi or Gujarati is the same kind of
 * best-effort gap — bestVoice() below picks the closest installed match it
 * can, but a device with no Hindi/Gujarati voice pack at all still falls back
 * to the browser's own default voice for that language, same as before.
 */

export type AnnounceLanguage = "en" | "hi" | "gu";

export type ReadyAnnouncement = { orderNumber: number; customerName: string };

const BCP47: Record<AnnounceLanguage, string> = {
  en: "en-IN",
  hi: "hi-IN",
  gu: "gu-IN",
};

/**
 * One order named per phrase, so nothing here ever has to compose a list —
 * unlike the old batched "12, 15 and 18" wording, there is no plural case in
 * any language once each sentence names exactly one order.
 */
const PHRASE_FOR: Record<AnnounceLanguage, (order: ReadyAnnouncement) => string> = {
  en: (order) => `Order number ${order.orderNumber} for ${order.customerName} is ready for pickup`,
  hi: (order) => `ऑर्डर नंबर ${order.orderNumber}, ${order.customerName} के लिए, पिकअप के लिए तैयार है`,
  gu: (order) => `ઓર્ડર નંબર ${order.orderNumber}, ${order.customerName} માટે, પિકઅપ માટે તૈયાર છે`,
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
 * Best installed voice for a language, or undefined to leave the browser's
 * own default in charge — better than throwing, and better than picking an
 * unrelated voice at random.
 *
 * Exact BCP-47 match first (e.g. "hi-IN"), then same base language ignoring
 * region (any "hi-*"), since a device with "hi-IN" specifically unavailable
 * but some other Hindi locale installed should still get real Hindi rather
 * than the OS default (often English on a device set up in English).
 */
function bestVoice(lang: AnnounceLanguage): SpeechSynthesisVoice | undefined {
  const bcp47 = BCP47[lang].toLowerCase();
  const base = bcp47.split("-")[0];
  return (
    cachedVoices.find((v) => v.lang.toLowerCase() === bcp47) ??
    cachedVoices.find((v) => v.lang.toLowerCase().startsWith(`${base}-`) || v.lang.toLowerCase() === base)
  );
}

/**
 * Speaks each newly-ready order once per enabled language, in the order the
 * restaurant configured (see screen-settings.tsx's reorder controls) —
 * unlike the old fixed English-then-Hindi-then-Gujarati order, this follows
 * `languages` exactly as given. speechSynthesis queues utterances rather
 * than overlapping them, so multiple orders and multiple languages just
 * chain into one queue rather than talking over each other.
 */
export function announceReady(orders: ReadyAnnouncement[], languages: AnnounceLanguage[]): void {
  if (orders.length === 0) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  for (const order of orders) {
    for (const lang of languages) {
      const utterance = new SpeechSynthesisUtterance(PHRASE_FOR[lang](order));
      utterance.lang = BCP47[lang];
      utterance.rate = 0.95;
      const voice = bestVoice(lang);
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    }
  }
}

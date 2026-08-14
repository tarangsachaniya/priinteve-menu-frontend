/**
 * Speaks a ready order's number aloud, for a guest who is not looking at the
 * wall the moment their number moves column. The chime says "something is
 * ready"; this says which one, so nobody has to walk over and check.
 *
 * Best-effort like the chime in chime.ts: an unsupported browser or a refusal
 * to speak must not break the board, just leave it relying on the flash and
 * the chime alone. A missing voice for Hindi or Gujarati is the same kind of
 * best-effort gap — the browser falls back to whatever default voice it has
 * rather than this throwing.
 */

export type AnnounceLanguage = "en" | "hi" | "gu";

/** Always spoken in this order, regardless of the order the restaurant enabled them in. */
const LANGUAGE_ORDER: AnnounceLanguage[] = ["en", "hi", "gu"];

const BCP47: Record<AnnounceLanguage, string> = {
  en: "en-IN",
  hi: "hi-IN",
  gu: "gu-IN",
};

/** One utterance per event rather than one per number — matches the chime's "one event to the room" rule. */
function joinNumbers(orderNumbers: number[], and: string): string {
  const [last, ...rest] = [...orderNumbers].reverse();
  return rest.length === 0 ? `${last}` : `${rest.reverse().join(", ")} ${and} ${last}`;
}

const PHRASE_FOR: Record<AnnounceLanguage, (orderNumbers: number[]) => string> = {
  en: (orderNumbers) => {
    const verb = orderNumbers.length === 1 ? "is" : "are";
    return `Order number ${joinNumbers(orderNumbers, "and")} ${verb} ready for pickup`;
  },
  hi: (orderNumbers) => {
    const verb = orderNumbers.length === 1 ? "है" : "हैं";
    return `ऑर्डर नंबर ${joinNumbers(orderNumbers, "और")} पिकअप के लिए तैयार ${verb}`;
  },
  gu: (orderNumbers) => `ઓર્ડર નંબર ${joinNumbers(orderNumbers, "અને")} પિકઅપ માટે તૈયાર છે`,
};

/**
 * Speaks the same ready announcement once per enabled language, always in the
 * fixed English → Hindi → Gujarati order regardless of how `languages` is
 * ordered. speechSynthesis queues utterances rather than overlapping them, so
 * calling speak() three times in a row here is what makes them play one after
 * another instead of on top of each other.
 */
export function announceReady(orderNumbers: number[], languages: AnnounceLanguage[]): void {
  if (orderNumbers.length === 0) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  for (const lang of LANGUAGE_ORDER) {
    if (!languages.includes(lang)) continue;

    const utterance = new SpeechSynthesisUtterance(PHRASE_FOR[lang](orderNumbers));
    utterance.lang = BCP47[lang];
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

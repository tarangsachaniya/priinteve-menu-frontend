import { cancelNative, hasVoiceFor, primeVoices, speakNative } from "./native";
import { cancelSarvam, speakSarvam } from "./sarvam";

/**
 * Which provider speaks a given announcement.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  English            →  device voice, always. Never Sarvam.               │
 * │  Other language     →  device voice IF one is installed for it,          │
 * │                        otherwise Sarvam.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The rule is "use what the machine already has, pay only when it doesn't".
 * Every OS ships an English voice, so English never needs to cost an API call
 * or a network round trip — and it is a hard rule here rather than an emergent
 * one, so a device with a broken voice list still cannot quietly start billing
 * for English.
 *
 * For other languages the check is possession of a real installed voice, not an
 * optimistic attempt: speechSynthesis happily reads Devanagari with an English
 * voice and reports success, which is precisely how browser TTS earned its
 * removal from this codebase the first time. See ./native.ts.
 *
 * Adding a provider means adding a branch here and a module beside these two.
 * Nothing outside this folder knows which provider spoke.
 */

export { primeVoices };

export type SpeakRequest = {
  lang: string;
  orderNumber: number;
  name?: string;
};

/** Relative path, through the Next proxy — same rule as ./sarvam.ts. */
function announceTextPath({ lang, orderNumber, name }: SpeakRequest): string {
  const base = `/api/order/announce-text?lang=${lang}&orderNumber=${orderNumber}`;
  return name ? `${base}&name=${encodeURIComponent(name)}` : base;
}

/**
 * The sentence to speak, from the API — never composed here.
 *
 * The phrasing lives in one place (the API's sarvam.ts PHRASE_FOR table) so
 * rewording an announcement does not mean editing it in two languages of code.
 * en/hi/gu are answered from a hardcoded table with no upstream call at all.
 */
async function fetchText(request: SpeakRequest): Promise<string | null> {
  try {
    const res = await fetch(announceTextPath(request), { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: unknown };
    return typeof data.text === "string" && data.text ? data.text : null;
  } catch {
    return null;
  }
}

/**
 * Speaks one announcement, resolving true only if a guest actually heard it.
 *
 * `onAudible` fires the moment sound starts, whichever provider produced it —
 * the queue uses it to stop the waiting track at exactly that instant, so the
 * two can never overlap.
 *
 * Never throws. A skipped announcement is the designed failure mode; the visual
 * flash and the chime are independent of speech and keep working regardless.
 */
export async function speak(
  request: SpeakRequest,
  onAudible?: () => void,
): Promise<boolean> {
  const { lang, orderNumber, name } = request;

  if (hasVoiceFor(lang)) {
    const text = await fetchText(request);
    if (text) {
      // Native speech has no "playing" event, so audible-start is announced
      // just before speak() rather than from inside it. The gap is a frame or
      // two, which is the right side to err on: stopping the waiting track a
      // moment early is silence, stopping it late is two sounds at once.
      onAudible?.();
      if (await speakNative(text, lang)) return true;
    }
  }

  /**
   * English never reaches Sarvam, by rule.
   *
   * If a device has no English voice at all — vanishingly rare, and a broken
   * machine rather than a supported configuration — this announcement is
   * skipped rather than billed. The chime still rings and the board still
   * flashes, which is what those exist for.
   */
  if (lang === "en") return false;

  return speakSarvam(lang, orderNumber, name, onAudible);
}

/** Stops whatever is speaking, whichever provider it is. */
export function cancelSpeech(): void {
  cancelNative();
  cancelSarvam();
}

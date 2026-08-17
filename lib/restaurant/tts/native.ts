/**
 * The device's own voice, via the Web Speech API.
 *
 * This exists so English stops going through a paid API. Every operating system
 * ships an English voice; synthesising one server-side cost money and a network
 * round trip to produce something the machine could already say instantly.
 *
 * ─── Why this is gated on an installed voice, not attempted optimistically ───
 *
 * Browser TTS was in this codebase once and was deliberately removed, because
 * Windows ships no Hindi or Gujarati voice. `speak()` does not fail in that
 * situation — it substitutes whatever voice it has and reads the Devanagari
 * with an English one, or says nothing at all, and reports success either way.
 * A waiting room heard confident nonsense and nobody could tell why.
 *
 * So hasVoiceFor() is the whole point of this module: it answers "is there a
 * real voice for this language on this device", and only then is speakNative()
 * allowed to try. Everything else falls through to Sarvam, which is the reason
 * Sarvam was bought.
 */

/**
 * Voices load asynchronously in Chrome — getVoices() returns [] on the very
 * first call and fills in later, announced by `voiceschanged`. Cached because
 * both call sites ask per announcement and the list changes only when the user
 * installs a voice pack, which is not a thing that happens mid-service.
 */
let cachedVoices: SpeechSynthesisVoice[] | null = null;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/** Kicks off voice loading early, so the first announcement isn't the one that waits. */
export function primeVoices(): void {
  const speech = synth();
  if (!speech) return;

  const load = () => {
    const voices = speech.getVoices();
    if (voices.length > 0) cachedVoices = voices;
  };

  load();
  // Assigned rather than added: this is idempotent, so calling primeVoices from
  // several components does not stack listeners on a global object.
  speech.onvoiceschanged = load;
}

function voices(): SpeechSynthesisVoice[] {
  if (cachedVoices) return cachedVoices;
  const speech = synth();
  if (!speech) return [];

  const list = speech.getVoices();
  if (list.length > 0) cachedVoices = list;
  return list;
}

/**
 * Whether this device can genuinely speak `lang`.
 *
 * Matched on the primary subtag, so "en" is satisfied by en-US, en-GB or en-IN.
 * A device with any English voice can say an English sentence; insisting on
 * en-IN would send a perfectly capable machine to Sarvam for no reason.
 */
export function hasVoiceFor(lang: string): boolean {
  const primary = lang.toLowerCase().split("-")[0];
  return voices().some((voice) => voice.lang.toLowerCase().split("-")[0] === primary);
}

/**
 * BCP-47 tag to request. The Indian variants are named explicitly because a
 * device that has both en-US and en-IN should use the one that reads Indian
 * order numbers and names the way a guest expects to hear them.
 */
const BCP47: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  gu: "gu-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  mr: "mr-IN",
  pa: "pa-IN",
  od: "or-IN",
};

/**
 * How long to wait for an utterance before giving up on it.
 *
 * speechSynthesis is genuinely unreliable about firing `end` — a backgrounded
 * tab, a page navigation mid-sentence, or a driver hiccup can leave the
 * callback pending forever. This queue is strictly sequential, so one lost
 * `end` event would wedge every announcement after it. The timeout is the
 * escape hatch, generous enough that a real sentence always finishes first.
 */
const UTTERANCE_TIMEOUT_MS = 15_000;

/**
 * Speaks one sentence, resolving true only if it was actually spoken.
 *
 * False means "this did not happen, try the next provider" — no voice, an
 * error, or the timeout above. Never throws, never rejects: a failed
 * announcement is a skipped announcement, never a broken screen.
 */
export function speakNative(text: string, lang: string): Promise<boolean> {
  const speech = synth();
  if (!speech || !hasVoiceFor(lang)) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (spoke: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(spoke);
    };

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = BCP47[lang] ?? lang;

    const primary = utterance.lang.toLowerCase().split("-")[0];
    // Pinning the voice, not just the lang tag: some browsers ignore `lang`
    // and use the default voice, which is the exact silent-wrong-language
    // failure this module exists to prevent.
    const voice = voices().find((v) => v.lang.toLowerCase() === utterance.lang.toLowerCase())
      ?? voices().find((v) => v.lang.toLowerCase().split("-")[0] === primary);
    if (voice) utterance.voice = voice;

    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);

    const timer = window.setTimeout(() => {
      // Cancel before resolving, or a stalled utterance keeps the engine busy
      // and swallows the next one too.
      speech.cancel();
      finish(false);
    }, UTTERANCE_TIMEOUT_MS);

    try {
      speech.speak(utterance);
    } catch {
      finish(false);
    }
  });
}

/** Stops anything currently being spoken. Used when a queue is torn down. */
export function cancelNative(): void {
  synth()?.cancel();
}

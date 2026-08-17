/**
 * Server-generated speech, for languages the device cannot say itself.
 *
 * This is the fallback, not the default — see ./native.ts. It is what covers
 * the case the provider was bought for: Windows ships no Hindi or Gujarati
 * voice, so a board running on a PC would otherwise be silent in exactly the
 * languages a restaurant most wants to announce in.
 *
 * The clip is produced by the API's Sarvam integration and served as WAV bytes
 * from /api/order/announce-audio, which is immutable-cached — so the second
 * time an order number comes round, this costs nothing.
 */

/**
 * Relative path only, never an absolute URL to the API host — every
 * browser-originated request in this app goes through the Next proxy at
 * app/api/[...path]/route.ts, same rule lib/restaurant/screen-paths.ts
 * follows for the mounted-screen endpoints.
 */
function announceAudioPath(lang: string, orderNumber: number, name?: string): string {
  const base = `/api/order/announce-audio?lang=${lang}&orderNumber=${orderNumber}`;
  return name ? `${base}&name=${encodeURIComponent(name)}` : base;
}

/**
 * One <audio> element for every announcement clip, reused rather than created
 * per play.
 *
 * Module-scoped and singular on purpose: the queue is strictly sequential, and
 * a second element would be a second thing that could be talking at the same
 * time. Reassigning .src on this one makes overlap structurally impossible
 * rather than something the caller has to be careful about.
 */
let sharedAudio: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement {
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

/**
 * How long to wait for a clip before giving up on it.
 *
 * A stalled fetch, a truncated response, or a browser that never fires `ended`
 * would otherwise hold the queue forever — and the previous implementation had
 * no escape from exactly that. Comfortably longer than any real announcement
 * plus the round trip that produces it.
 */
const CLIP_TIMEOUT_MS = 20_000;

/**
 * Fetches and plays one clip, resolving true only if it actually played.
 *
 * False covers everything else — a 502/503 from an unconfigured or failing
 * provider, a network error, autoplay refusal, or the timeout above. Never
 * throws: both callers poll inside a try/catch that counts a throw as a failed
 * poll, so a missing clip must not surface as one.
 *
 * `onStart` fires on the `playing` event — audible start, not merely a resolved
 * play() promise, which can land before the browser has produced any sound. The
 * queue uses it to stop the waiting track at the exact moment speech begins.
 */
export function speakSarvam(
  lang: string,
  orderNumber: number,
  name: string | undefined,
  onStart?: () => void,
): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  const audio = getAudioElement();

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let started = false;

    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("playing", onPlaying);
      resolve(played);
    };

    const onEnded = () => finish(true);
    const onError = () => finish(false);
    const onPlaying = () => {
      started = true;
      onStart?.();
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("playing", onPlaying);

    const timer = window.setTimeout(() => {
      // If it never became audible, nothing was announced. If it did and the
      // `ended` event simply never arrived, the guest heard it — report the
      // truth in both directions rather than one convenient default.
      audio.pause();
      finish(started);
    }, CLIP_TIMEOUT_MS);

    audio.src = announceAudioPath(lang, orderNumber, name);
    audio.play().catch(() => finish(false));
  });
}

/** Stops any clip in flight. Used when a queue is torn down. */
export function cancelSarvam(): void {
  if (!sharedAudio) return;
  sharedAudio.pause();
  // Clearing src as well as pausing, so a half-buffered clip is not resumed by
  // a later play() on the shared element.
  sharedAudio.removeAttribute("src");
  sharedAudio.load();
}

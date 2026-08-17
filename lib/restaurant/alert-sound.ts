import type { Damru } from "@/lib/restaurant/damru";

/**
 * A restaurant's own uploaded sound, wrapping the synthesized one it replaces.
 *
 * ─── Why a wrapper rather than an option inside damru.ts ────────────────────
 *
 * damru.ts and chime.ts are carefully tuned Web Audio synthesis — pitch sweeps,
 * a shared limiter across overlapping phrases, an iOS unlock latch. None of that
 * has anything to do with "play this MP3", and threading a file path through it
 * would put two unrelated implementations inside one set of branches. Keeping
 * the override outside means the synthesized path is byte-for-byte the code
 * that has been ringing in kitchens for months, and stays the fallback when no
 * file is configured — which is most restaurants, most of the time.
 *
 * The wrapper presents the same shape the synthesized drum does, so
 * order-alert-provider.tsx calls play()/unlock()/isUnlocked() without knowing
 * or caring which one it got.
 *
 * ─── Unlocking ─────────────────────────────────────────────────────────────
 *
 * Both paths need the same thing — one real user gesture — but they need it
 * differently: an AudioContext needs resume(), an HTMLAudioElement needs a
 * play() that originated in a gesture. unlock() does both, so a single tap arms
 * whichever path is in use now AND whichever one is switched to later, without
 * asking the user again when a restaurant uploads a file mid-shift.
 */

export type AlertSound = {
  unlock: () => Promise<void>;
  play: () => void;
  stopAll: () => void;
  isUnlocked: () => boolean;
  needsReArm: () => boolean;
  /** Null returns to the synthesized sound. Safe to call on every poll. */
  setSource: (url: string | null) => void;
};

export function createAlertSound(fallback: Damru): AlertSound {
  let element: HTMLAudioElement | null = null;
  let source: string | null = null;
  let elementUnlocked = false;
  /** True once the element has tried and failed to play, so the UI can say so. */
  let elementBlocked = false;

  function audio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!element) element = new Audio();
    return element;
  }

  return {
    setSource: (url) => {
      if (url === source) return; // Called from a poll; reassigning src would restart it.
      source = url;

      const el = audio();
      if (!el) return;

      if (url) {
        el.src = url;
        el.load();
      } else {
        el.removeAttribute("src");
      }
    },

    unlock: async () => {
      await fallback.unlock();

      const el = audio();
      if (!el) return;

      /**
       * Priming trick: a muted play/pause inside the gesture marks the element
       * as user-activated for the rest of the page's life, so a later
       * unmuted play() from a timer is allowed. Without it the element is
       * blocked the same way an un-resumed AudioContext is, and the restaurant
       * would be asked to tap again the first time an order actually arrived.
       */
      const wasMuted = el.muted;
      el.muted = true;
      try {
        await el.play();
        el.pause();
        el.currentTime = 0;
        elementUnlocked = true;
        elementBlocked = false;
      } catch {
        // No source yet is the ordinary case here and not a failure — the
        // element is armed by the gesture regardless, so do not mark it blocked.
        if (source) elementBlocked = true;
      } finally {
        el.muted = wasMuted;
      }
    },

    play: () => {
      if (!source) {
        fallback.play();
        return;
      }

      const el = audio();
      if (!el) return;

      // Rewound rather than resumed: two orders arriving four seconds apart
      // must each get the whole sound from the start, not the tail of the last.
      el.currentTime = 0;
      el.play().then(
        () => {
          elementUnlocked = true;
          elementBlocked = false;
        },
        () => {
          elementBlocked = true;
          // The synthesized drum shares the AudioContext unlock, which may well
          // be armed even when the element is not — so a blocked file still
          // rings rather than leaving the kitchen silent.
          fallback.play();
        },
      );
    },

    stopAll: () => {
      fallback.stopAll();
      if (element && source) {
        element.pause();
        element.currentTime = 0;
      }
    },

    // Either path being armed counts: play() falls back to the drum when the
    // element is blocked, so the caller's question — "will a sound come out?" —
    // is answered yes.
    isUnlocked: () => fallback.isUnlocked() || elementUnlocked,

    needsReArm: () => {
      if (source) return elementBlocked && fallback.needsReArm();
      return fallback.needsReArm();
    },
  };
}

/**
 * The looping bed played while an announcement is being prepared.
 *
 * Not an alert and not an announcement — a "working on it" indicator covering
 * the second or two of dead air while speech is fetched, which otherwise reads
 * as the board having frozen.
 *
 * start()/stop() are idempotent and stop() is called unconditionally on every
 * exit path in the queue, including failures. That is deliberate: a bed still
 * looping after a failed announcement is worse than never having played one.
 */
export type WaitingTrack = {
  start: () => void;
  stop: () => void;
  setSource: (url: string | null) => void;
};

export function createWaitingTrack(): WaitingTrack {
  let element: HTMLAudioElement | null = null;
  let source: string | null = null;
  const builtIn = createBuiltInWaitingBed();

  function audio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!element) {
      element = new Audio();
      element.loop = true;
      // Under the speech it precedes, not competing with it — this is
      // background by definition.
      element.volume = 0.35;
    }
    return element;
  }

  return {
    setSource: (url) => {
      if (url === source) return;
      source = url;

      const el = audio();
      if (!el) return;

      if (url) {
        el.src = url;
        el.load();
      } else {
        el.pause();
        el.removeAttribute("src");
      }
    },

    start: () => {
      // No uploaded file: the synthesized bed, so the gap is covered out of the
      // box rather than only for restaurants that have been to the settings
      // screen. Same fallback shape as the alert sounds above.
      if (!source) {
        builtIn.start();
        return;
      }

      const el = audio();
      if (!el || !el.paused) return;
      el.currentTime = 0;
      // Autoplay refusal here is genuinely fine and must stay silent: the
      // announcement itself is what matters, and it has its own unlock path.
      el.play().catch(() => {});
    },

    stop: () => {
      builtIn.stop();
      if (!element) return;
      element.pause();
      element.currentTime = 0;
    },
  };
}

/**
 * The default waiting bed, synthesized rather than shipped as a file.
 *
 * Every other sound in this product is Web Audio (damru.ts, chime.ts) and there
 * is not a single audio binary in the repository — matching that keeps the
 * bundle unchanged and means the fallback cannot 404.
 *
 * What it is: two very quiet sine tones pulsing about once a second, a fifth
 * apart. Deliberately unremarkable. This plays UNDER an announcement that is
 * about to start and its whole job is to stop a second of dead air reading as
 * "the board has frozen" — anything more characterful would compete with the
 * words it exists to introduce, and would be the third distinct sound a guest
 * hears in five seconds.
 */
type BuiltInBed = { start: () => void; stop: () => void };

function createBuiltInWaitingBed(): BuiltInBed {
  /** Quiet on purpose: a bed, not an alert. */
  const GAIN = 0.05;
  const PULSE_MS = 900;
  const TONES = [392, 262];

  let ctx: AudioContext | null = null;
  let timer: number | undefined;
  let index = 0;

  function context(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (ctx) return ctx;

    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;

    ctx = new Ctor();
    return ctx;
  }

  function pulse(): void {
    const audio = context();
    if (!audio) return;
    // A suspended context here needs no user gesture to resume — the page has
    // one by this point or the announcement itself would not be playing either.
    if (audio.state === "suspended") void audio.resume().catch(() => {});

    const at = audio.currentTime + 0.02;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(TONES[index % TONES.length]!, at);
    index += 1;

    // Faded in and out rather than switched: a gated sine clicks at both ends,
    // and a click every second is far more noticeable than the tone itself.
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(GAIN, at + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);

    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.5);
    osc.onended = () => gain.disconnect();
  }

  return {
    start: () => {
      if (timer !== undefined) return; // Idempotent — the queue calls this per item.
      index = 0;
      pulse();
      timer = window.setInterval(pulse, PULSE_MS);
    },

    stop: () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
      // Scheduled oscillators stop themselves within half a second, so nothing
      // is torn down here — cutting them dead would produce the click the
      // envelope above exists to avoid.
    },
  };
}

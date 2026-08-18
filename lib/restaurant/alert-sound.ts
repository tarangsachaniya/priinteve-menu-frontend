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
  /**
   * Keeps sounding for `durationMs`, then stops itself.
   *
   * For the kitchen display, where a single phrase under a second long is one
   * chance to be noticed by someone across the room with their hands full.
   * stopAll() ends the window early, which is how "a cook touched a ticket"
   * silences it.
   *
   * Zero or less degrades to a plain play(), so "ring once" is expressible
   * without the caller branching.
   */
  playFor: (durationMs: number) => void;
  stopAll: () => void;
  isUnlocked: () => boolean;
  needsReArm: () => boolean;
  /** Null returns to the synthesized sound. Safe to call on every poll. */
  setSource: (url: string | null) => void;
  /**
   * True when a file IS configured but the synthesized drum is what the room
   * actually hears — the element was refused, or the file will not load.
   *
   * Distinct from `isUnlocked()`, which answers "will any sound come out". Both
   * can be true at once, and that combination is exactly the failure this
   * exists to expose: a restaurant that uploaded a track, hears the drum, and
   * is told everything is working.
   */
  isSubstituting: () => boolean;
};

/**
 * How often the synthesized drum is re-struck while filling a ring window.
 *
 * A damru phrase is eight strikes at 85ms plus a tail — a shade under a second
 * — and it has no loop of its own, so a 30-second window has to re-trigger it.
 * Matches RING_INTERVAL_MS in order-alert-provider.tsx deliberately: the two
 * are the same sound at the same urgency, and a kitchen hearing a different
 * cadence from the till would read them as two different alerts.
 *
 * An uploaded FILE is never driven by this — it loops natively instead, so a
 * twenty-second track plays as a twenty-second track rather than being
 * restarted nine-tenths of a second in.
 */
const DRUM_REPEAT_MS = 900;

export function createAlertSound(fallback: Damru): AlertSound {
  let element: HTMLAudioElement | null = null;
  let source: string | null = null;
  let elementUnlocked = false;
  /** True once the element has tried and failed to play, so the UI can say so. */
  let elementBlocked = false;
  /** Set when the file itself is unusable — a 404/403, or a codec this browser won't take. */
  let sourceBroken = false;

  /**
   * ─── THE LATCH BUG THIS FLAG EXISTS TO PREVENT ─────────────────────────────
   *
   * Pausing a media element while its play() promise is still pending rejects
   * that promise with AbortError ("The play() request was interrupted by a call
   * to pause()"). This code pauses the element in two places of its own accord —
   * stopAll(), and the muted prime — and BOTH are routinely called while a real
   * alert is sounding:
   *
   *   stopAll()      fires the instant an order is accepted, which is very often
   *                  mid-phrase.
   *   primeElement() was wired to a non-`once` pointerdown listener, so any tap
   *                  anywhere on the console or the kitchen screen ran it.
   *
   * The rejection handler in play() then read AbortError as "this file is
   * broken", set sourceBroken, and — because sourceBroken is only ever cleared
   * when the URL itself changes — every later alert on that page fell back to
   * the synthesized drum, permanently. That is the whole of "I uploaded a track
   * and still hear the damru": the track worked, and then one Accept or one tap
   * turned it off for the life of the page.
   *
   * So an interruption WE caused is not evidence about the file. This counter is
   * bumped before every such pause; play() captures it and discards any
   * rejection that arrives after a bump.
   */
  let interruptions = 0;

  /**
   * Bumped by every real play() request, so the muted prime can tell that an
   * actual alert took the element over while it was mid-flight.
   *
   * The case: the kitchen's poll calls setSource() and then play() in the same
   * tick, the first time it ever learns the URL. setSource kicks off a prime
   * that has already set `muted = true` by the time play() runs, and would then
   * pause the very alert play() just started. Silence, for the one arrival that
   * mattered most. See the takeover branch in primeElement().
   */
  let playRequests = 0;

  /**
   * The open ring window, if playFor() has one running.
   *
   * `repeat` re-strikes the drum; `deadline` closes the window. Held together
   * because they are always started and always cancelled as a pair — a repeat
   * left running past its deadline is an alert that never stops, which is the
   * one failure mode worse than an alert nobody hears.
   */
  let repeatTimer: number | undefined;
  let deadlineTimer: number | undefined;

  function audio(): HTMLAudioElement | null {
    if (typeof window === "undefined") return null;
    if (!element) {
      element = new Audio();
      /**
       * A load failure never reaches play()'s rejection handler — the element
       * simply stays empty and every play() resolves without a sound. Without
       * this listener a 403 on the uploaded file is indistinguishable from
       * autoplay being blocked, which is what made this class of bug
       * undiagnosable from a bug report.
       */
      element.addEventListener("error", () => {
        if (!source) return;
        sourceBroken = true;
        console.warn(
          `[alert-sound] uploaded track failed to load, falling back to the drum:`,
          source,
          element?.error?.message ?? "",
        );
      });
    }
    return element;
  }

  /**
   * Marks the element user-activated using a muted play/pause.
   *
   * Only meaningful once there is a src: priming an empty element rejects with
   * no activation granted, which is the whole reason the uploaded track never
   * played — unlock() ran on mount, before the first poll had supplied a URL,
   * and nothing tried again afterwards.
   *
   * TWO GUARDS, and they are the point rather than an optimisation:
   *
   *   already armed   there is nothing left to prove, so a later tap must not
   *                   touch the element at all.
   *   already playing an alert is sounding RIGHT NOW. Muting and pausing it to
   *                   prove the browser would allow a sound is self-defeating —
   *                   it cuts the alert short and, before the `interruptions`
   *                   counter existed, latched the file off for good.
   */
  async function primeElement(el: HTMLAudioElement): Promise<void> {
    if (elementUnlocked) return;
    if (!el.paused) {
      // Audible playback is stronger proof than any prime could be.
      elementUnlocked = true;
      elementBlocked = false;
      return;
    }

    const wasMuted = el.muted;
    const startedAt = playRequests;
    el.muted = true;
    try {
      await el.play();

      // A real alert came through while this was in flight — it is playing now,
      // and pausing it to finish proving a point would be the bug this whole
      // guard exists for. Its own play() unmuted the element; the `finally`
      // below restores the pre-prime state anyway.
      if (playRequests !== startedAt) {
        elementUnlocked = true;
        elementBlocked = false;
        return;
      }

      // Ending the prime is an interruption of our own making. Counted even
      // though nothing real should be in flight here, because the pause below
      // would otherwise reject a play() that raced in between.
      interruptions += 1;
      el.pause();
      el.currentTime = 0;
      elementUnlocked = true;
      elementBlocked = false;
    } catch {
      // No source yet is the ordinary case and not a failure — the gesture
      // still arms the element for later.
      if (source) elementBlocked = true;
    } finally {
      el.muted = wasMuted;
    }
  }

  /**
   * True when a file IS configured but the drum is what the room actually
   * hears. Hoisted out of the returned object so the ring loop below can ask
   * the same question the caller can — see playFor().
   */
  function isSubstituting(): boolean {
    return source !== null && (elementBlocked || sourceBroken);
  }

  /**
   * Tears down an open ring window WITHOUT silencing anything.
   *
   * Split from stopAll() because the two are needed apart: playFor() calls this
   * to replace a window with a fresh one (a second order arriving mid-ring
   * should restart the clock, not stack a second set of timers), while stopAll()
   * calls it and then goes on to cut the sound.
   *
   * Clearing `loop` here rather than in stopAll() is what stops a later plain
   * play() inheriting a looping element and ringing forever.
   */
  function clearRing(): void {
    if (repeatTimer !== undefined) window.clearInterval(repeatTimer);
    if (deadlineTimer !== undefined) window.clearTimeout(deadlineTimer);
    repeatTimer = undefined;
    deadlineTimer = undefined;
    if (element) element.loop = false;
  }

  function play(): void {
    if (!source) {
      fallback.play();
      return;
    }

    const el = audio();
    if (!el) return;

    // A file that will not load can never ring; go straight to the drum
    // rather than waiting on a play() that resolves silently.
    if (sourceBroken) {
      fallback.play();
      return;
    }

    playRequests += 1;
    // Rewound rather than resumed: two orders arriving four seconds apart
    // must each get the whole sound from the start, not the tail of the last.
    // Still true when playFor() has set `loop` — a second arrival opens a new
    // window and the restaurant's track has to start over for it, not be
    // inherited half-played from the order before.
    el.currentTime = 0;
    // Asserted rather than assumed: a prime racing this in the same tick has
    // already set muted, and an alert nobody can hear is the same failure as
    // no alert at all.
    el.muted = false;
    // Captured before the attempt: anything that bumps this while play() is
    // in flight is us stopping our own sound, not the browser or the file
    // refusing it. See `interruptions` at the top of the factory.
    const attemptedAt = interruptions;
    el.play().then(
      () => {
        elementUnlocked = true;
        elementBlocked = false;
      },
      (err: unknown) => {
        /**
         * We cut it short ourselves — an Accept that called stopAll(), or a
         * prime that raced in. Nothing has been learned about the file or the
         * browser's willingness to play it, so nothing may be recorded, and
         * the drum must NOT ring: silence is the whole point of stopAll().
         */
        if (interruptions !== attemptedAt) return;

        elementBlocked = true;
        /**
         * The reason used to be discarded, which is precisely why "I uploaded
         * a track and hear the drum" could not be diagnosed from a report.
         * NotAllowedError means the browser refused an unprompted sound and a
         * tap fixes it; NotSupportedError means this browser cannot play the
         * file at all and no amount of tapping will help.
         *
         * Anything else is left recoverable on purpose. Marking the source
         * broken is a one-way latch for the life of the page, so it is spent
         * only on the one error that genuinely means "never going to work" —
         * the `error` listener in audio() above covers the load failures.
         */
        const name = err instanceof Error ? err.name : "unknown";
        if (name === "NotSupportedError") sourceBroken = true;
        console.warn(
          `[alert-sound] uploaded track refused (${name}), falling back to the drum:`,
          source,
        );
        // The synthesized drum shares the AudioContext unlock, which may well
        // be armed even when the element is not — so a blocked file still
        // rings rather than leaving the kitchen silent.
        fallback.play();
      },
    );
  }

  function stopAll(): void {
    // First, so a repeat cannot fire between silencing the drum and the timers
    // being cancelled — that stray strike would land after the alert was
    // supposed to be over, which reads as the stop button not working.
    clearRing();

    fallback.stopAll();
    if (element && source) {
      // Bumped BEFORE the pause: a play() still in flight is about to reject
      // with AbortError, and this is what tells its handler the abort was
      // ours. Without it, accepting an order mid-phrase used to convict the
      // uploaded file and hand the rest of the shift to the drum.
      interruptions += 1;
      element.pause();
      element.currentTime = 0;
    }
  }

  /**
   * Rings for a fixed window rather than once.
   *
   * TWO MECHANISMS, because the two sounds are not the same kind of thing:
   *
   *   uploaded file  loops natively. A restaurant's twenty-second track plays
   *                  as a twenty-second track; re-triggering it on a timer
   *                  would restart it nine-tenths of a second in and the room
   *                  would never hear past the first word.
   *   damru          has no loop, so it is re-struck on DRUM_REPEAT_MS.
   *
   * The repeat is guarded on isSubstituting() rather than started blindly:
   * play() falls back to the drum on its own when the element is refused, and
   * without the guard a working uploaded file would have the drum banging over
   * the top of it for the whole window.
   *
   * The deadline calls stopAll(), which bumps `interruptions` before pausing —
   * so the AbortError that pause produces is correctly read as self-inflicted
   * and does NOT latch sourceBroken. That latch is the "I uploaded a track and
   * still hear the damru" bug; see the note on `interruptions` above.
   */
  function playFor(durationMs: number): void {
    // Replaces any window already open. A second order arriving mid-ring
    // restarts the clock rather than stacking a second set of timers.
    clearRing();

    if (durationMs <= 0) {
      play();
      return;
    }

    const el = source && !sourceBroken ? audio() : null;
    if (el) el.loop = true;

    play();

    repeatTimer = window.setInterval(() => {
      if (!source || isSubstituting()) fallback.play();
    }, DRUM_REPEAT_MS);

    deadlineTimer = window.setTimeout(stopAll, durationMs);
  }

  return {
    setSource: (url) => {
      if (url === source) return; // Called from a poll; reassigning src would restart it.
      source = url;
      sourceBroken = false;

      const el = audio();
      if (!el) return;

      if (url) {
        // load() abandons whatever the element was doing, which rejects a
        // play() in flight exactly as pause() does. Rare — the URL only changes
        // when an owner uploads mid-shift — but it is the same self-inflicted
        // abort, and it must not be read as the new file being bad.
        interruptions += 1;
        el.src = url;
        el.load();

        /**
         * THE FIX FOR "I UPLOADED A TRACK AND STILL HEAR THE DRUM".
         *
         * unlock() runs on mount, which is before this poll has ever supplied a
         * URL — so it primed an element with no src, that play() rejected, and
         * elementUnlocked stayed false forever. Every later ring was then a
         * timer-initiated play() on an element the browser had never seen
         * activated, so it was refused and the drum rang in its place.
         *
         * Priming again here, now that there IS something to prime with, is
         * what closes that window. It relies on the sticky user activation an
         * earlier gesture left on the document, so it succeeds whenever anyone
         * has touched the page at all — and simply fails quietly when nobody
         * has, leaving the existing gesture listeners to arm it.
         */
        if (!elementUnlocked) void primeElement(el);
      } else {
        el.removeAttribute("src");
      }
    },

    unlock: async () => {
      await fallback.unlock();

      const el = audio();
      if (!el) return;

      /**
       * A muted play/pause inside the gesture marks the element as
       * user-activated for the rest of the page's life, so a later unmuted
       * play() from a timer is allowed. Without it the element is blocked the
       * same way an un-resumed AudioContext is, and the restaurant would be
       * asked to tap again the first time an order actually arrived.
       *
       * setSource() primes too, for the case where the gesture happened before
       * the URL existed. primeElement() no-ops once armed, so the always-on
       * gesture listeners above this can call unlock() on every tap for the
       * AudioContext's sake without ever disturbing the media element.
       */
      await primeElement(el);
    },

    play,

    playFor,

    stopAll,

    // Only meaningful when a file is configured: with no source the drum is the
    // intended sound, not a substitute for anything.
    isSubstituting,

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

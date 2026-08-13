/**
 * The damru — synthesized, not sampled.
 *
 * A damru is the small hourglass drum of Shiva: two heads, knotted cords with a
 * bead on each end, and a twist of the wrist that whips the beads alternately
 * against one head then the other. What you hear is a fast run of short, sharp,
 * pitched membrane strikes rather than a single hit, and the two heads are
 * tuned slightly apart, which is what gives the run its characteristic tumbling
 * quality.
 *
 * WHY SYNTHESIZED: no audio file to ship, host, cache-bust or license, nothing
 * to 404, and it works offline. The whole thing is about eighty lines of
 * oscillator scheduling and costs nothing to load.
 *
 * HOW ONE STRIKE IS BUILT — two layers, because a drum is two things at once:
 *
 *   body      a triangle oscillator sweeping DOWN in pitch (a struck membrane
 *             loses tension as it rebounds, so its pitch falls; a fixed-pitch
 *             oscillator reads as a beep, and this sweep is most of what makes
 *             it read as a drum instead)
 *   transient the bead's slap on the skin — a burst of filtered noise, 15ms,
 *             gone before the body has finished falling
 *
 * ALL SCHEDULING IS SAMPLE-ACCURATE. Every node is started against
 * ctx.currentTime + offset rather than from a setTimeout, so the rhythm holds
 * even on a busy main thread — which, on a till running a kitchen board, is
 * the normal condition rather than the exception.
 */

/** Strikes in one play(). Enough to read as a roll, short enough not to nag. */
const STRIKE_COUNT = 7;

/** Seconds between strikes. ~9.5 per second — a wrist twist, not a drum machine. */
const STRIKE_GAP = 0.105;

/**
 * The two heads. Tuned a minor third apart rather than in unison: identical
 * pitches sound like a machine gun, and a wide interval sounds like two
 * different instruments.
 */
const HEAD_PITCHES = [196, 165];

/** Where each strike's pitch sweep lands, as a fraction of where it started. */
const PITCH_FALL = 0.5;

export type Damru = {
  /**
   * Must be called from inside a real user gesture. See the autoplay note on
   * the implementation below — this is the whole reason the console has an
   * "Enable sound" affordance.
   */
  unlock: () => Promise<void>;
  /** No-op when still locked, so callers never have to check first. */
  play: () => void;
  isUnlocked: () => boolean;
};

type AudioContextConstructor = typeof AudioContext;

function getAudioContextCtor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ??
    null
  );
}

/**
 * One bead strike on one head.
 *
 * `velocity` is 0–1 and scales loudness only. Real playing is uneven, and a run
 * of seven identical strikes is the single biggest giveaway that a drum sound
 * was generated rather than played.
 */
function strike(ctx: AudioContext, destination: GainNode, at: number, pitch: number, velocity: number): void {
  // ── body ──────────────────────────────────────────────────────────────────
  const body = ctx.createOscillator();
  const bodyGain = ctx.createGain();

  body.type = "triangle";
  body.frequency.setValueAtTime(pitch, at);
  // exponentialRamp, not linear: pitch is perceived logarithmically, and a
  // linear fall sounds like it slows down at the bottom.
  body.frequency.exponentialRampToValueAtTime(pitch * PITCH_FALL, at + 0.06);

  bodyGain.gain.setValueAtTime(0.0001, at);
  bodyGain.gain.exponentialRampToValueAtTime(velocity, at + 0.002); // 2ms attack — a strike, not a swell
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);

  body.connect(bodyGain).connect(destination);
  body.start(at);
  body.stop(at + 0.14);

  // ── transient ─────────────────────────────────────────────────────────────
  // A short noise burst standing in for the bead hitting the skin. Bandpassed
  // high: the low end is the body's job, and doubling it just makes mud.
  const noiseLength = Math.floor(ctx.sampleRate * 0.03);
  const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i += 1) {
    // Pre-decayed inside the buffer, so the envelope below only has to shape
    // the tail rather than fight the noise's flat amplitude.
    channel[i] = (Math.random() * 2 - 1) * (1 - i / noiseLength);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.setValueAtTime(1600, at);
  bandpass.Q.setValueAtTime(1.2, at);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(velocity * 0.35, at);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.015);

  noise.connect(bandpass).connect(noiseGain).connect(destination);
  noise.start(at);
  noise.stop(at + 0.03);
}

export function createDamru(): Damru {
  let ctx: AudioContext | null = null;
  let unlocked = false;

  function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  }

  return {
    isUnlocked: () => unlocked && ctx?.state === "running",

    /**
     * Autoplay policy is the real constraint on this whole feature.
     *
     * Every browser creates an AudioContext in the "suspended" state and will
     * only resume it inside a user gesture. So a console that has been sitting
     * untouched since page load CANNOT make a sound, no matter what the push
     * delivers — which is why the alert provider unlocks on the first click or
     * keypress anywhere in the console, and why the popup offers an explicit
     * "Enable sound" button when that has not happened yet.
     *
     * The silent one-sample buffer is not superstition: on iOS, resume() alone
     * leaves the context in a state where the first real sound is swallowed.
     * Playing something — anything — inside the gesture is what actually arms
     * it.
     */
    unlock: async () => {
      const audio = context();
      if (!audio) return;

      if (audio.state === "suspended") {
        await audio.resume().catch(() => {});
      }

      const silent = audio.createBufferSource();
      silent.buffer = audio.createBuffer(1, 1, audio.sampleRate);
      silent.connect(audio.destination);
      silent.start(0);

      unlocked = audio.state === "running";
    },

    play: () => {
      const audio = context();
      if (!audio || audio.state !== "running") return;

      const master = audio.createGain();
      master.gain.setValueAtTime(0.9, audio.currentTime);
      master.connect(audio.destination);

      // A hair in the future: scheduling exactly at currentTime races the audio
      // thread and can clip the first strike's attack.
      const start = audio.currentTime + 0.02;

      for (let i = 0; i < STRIKE_COUNT; i += 1) {
        const isLast = i === STRIKE_COUNT - 1;
        const pitch = HEAD_PITCHES[i % HEAD_PITCHES.length];

        // Slight random unevenness through the run, then a firm accent on the
        // last strike — the wrist stopping, which is how a real damru phrase
        // ends rather than just running out.
        const velocity = isLast ? 0.95 : 0.55 + Math.random() * 0.2;

        strike(audio, master, start + i * STRIKE_GAP, pitch, velocity);
      }

      // Release the master node once the tail is gone. Without this, a console
      // left open through a busy service accumulates one orphaned GainNode per
      // order for the life of the page.
      window.setTimeout(
        () => master.disconnect(),
        (STRIKE_COUNT * STRIKE_GAP + 0.3) * 1000,
      );
    },
  };
}

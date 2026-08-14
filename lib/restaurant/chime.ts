/**
 * The "your order is ready" chime — synthesized, like the damru, and for the
 * same reasons (see damru.ts): nothing to ship, host, cache-bust or license,
 * and nothing to 404.
 *
 * DELIBERATELY NOT A QUIETER DAMRU. The two sounds talk to different people in
 * different rooms and must not be confused for one another:
 *
 *   damru   staff, in the kitchen. Falling pitch, 2ms attack, a hard run of
 *           seven strikes, master gain 0.9. It reads as "attention", and it
 *           repeats until someone acts.
 *   chime   guests, in a room where people are eating. Two sine notes RISING a
 *           perfect fifth, soft 8ms attack, a long decay, master gain 0.25. It
 *           reads as "good news", and it plays exactly once.
 *
 * The single biggest thing making this a bell rather than a drum is what is
 * absent: there is no noise transient. The bandpassed burst in damru.ts is what
 * makes that sound like a bead striking a skin, and leaving it out is most of
 * why this sounds struck-metal instead.
 */

/** A5 then E6 — a rising perfect fifth. Rising intervals read as resolution. */
const NOTES = [880, 1318.5];

/** Seconds between the two notes. Long enough to be two notes, short enough to be one gesture. */
const NOTE_GAP = 0.18;

/** Seconds each note takes to fall away. A bell rings on; it does not stop. */
const DECAY = 1.2;

/**
 * Cents of detune on the doubled oscillator. Two oscillators a few cents apart
 * beat slowly against each other, which is the shimmer real struck metal has and
 * a single sine conspicuously lacks.
 */
const DETUNE_CENTS = 3;

/** Against the damru's 0.9. This plays in a dining room, not a kitchen. */
const MASTER_GAIN = 0.25;

export type Chime = {
  /** Must be called from inside a real user gesture. See the note on unlock below. */
  unlock: () => Promise<void>;
  /** No-op while still locked, so callers never have to check first. */
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

/** One note: two detuned sines under a single soft envelope. */
function ring(ctx: AudioContext, destination: GainNode, at: number, frequency: number): void {
  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0.0001, at);
  // 8ms, against the damru's 2ms. A struck bell still has an attack — it just
  // is not a slap, and anything faster than about 5ms starts to click.
  noteGain.gain.exponentialRampToValueAtTime(1, at + 0.008);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, at + DECAY);
  noteGain.connect(destination);

  for (const detune of [0, DETUNE_CENTS]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, at);
    osc.detune.setValueAtTime(detune, at);
    osc.connect(noteGain);
    osc.start(at);
    osc.stop(at + DECAY + 0.05);
  }
}

export function createChime(): Chime {
  let ctx: AudioContext | null = null;
  let unlocked = false;

  function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  }

  function schedule(audio: AudioContext): void {
    const master = audio.createGain();
    master.gain.setValueAtTime(MASTER_GAIN, audio.currentTime);
    master.connect(audio.destination);

    // A hair in the future: scheduling exactly at currentTime races the audio
    // thread and can clip the attack.
    const start = audio.currentTime + 0.02;
    NOTES.forEach((frequency, index) => ring(audio, master, start + index * NOTE_GAP, frequency));

    window.setTimeout(() => master.disconnect(), (NOTE_GAP + DECAY + 0.3) * 1000);
  }

  return {
    isUnlocked: () => unlocked,

    /**
     * THE WALL-DISPLAY PROBLEM, and it is worse here than for the damru.
     *
     * Every browser creates an AudioContext suspended and only resumes it inside
     * a user gesture. A console at least gets clicked eventually. A pickup board
     * on a lobby wall is NEVER touched — that is what it is for — and the latch
     * cannot be persisted, because a fresh page load always starts suspended no
     * matter what any stored preference says.
     *
     * So the display has to ask, once, out loud: a bar that says "tap anywhere
     * to turn on the ready chime" and stays until this succeeds. That bar is not
     * a nicety; without it the chime silently never plays and nobody can tell
     * why. The visual flash is the primary signal for exactly this reason, and
     * the chime is the escalation.
     *
     * The silent one-sample buffer is not superstition: on iOS, resume() alone
     * leaves the context in a state where the first real sound is swallowed.
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

      // Latches on, never off — same one-way rule as the damru, so a later
      // unlock() firing against a suspended context cannot disarm a chime that
      // has already been armed once.
      if (audio.state === "running") unlocked = true;
    },

    play: () => {
      const audio = context();
      if (!audio || !unlocked) return;

      if (audio.state === "running") {
        schedule(audio);
        return;
      }

      // A display left alone long enough gets its context suspended to save
      // power. Resuming needs no fresh gesture — the original unlock gave this
      // page sticky activation, and that is what the browser checks.
      void audio
        .resume()
        .then(() => {
          if (audio.state === "running") schedule(audio);
        })
        .catch(() => {
          // Refused. The flash still runs, which is the signal that matters.
        });
    },
  };
}

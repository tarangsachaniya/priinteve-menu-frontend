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

/**
 * Strikes in one play(). Was 7, "enough to read as a roll, short enough not
 * to nag" — but an unaccepted order is exactly the moment nagging is the
 * point, and the ring loop now calls play() back-to-back rather than pausing
 * between phrases, so a longer, denser roll reads as more urgent instead of
 * as noise.
 */
const STRIKE_COUNT = 8;

/** Seconds between strikes. Was 0.105 (~9.5/sec); tightened for urgency. */
const STRIKE_GAP = 0.085;

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
  /**
   * Cuts short every phrase currently sounding.
   *
   * The drum now repeats until an order is accepted or cancelled, so the moment
   * someone taps Accept there is very often a run mid-flight with four strikes
   * still scheduled. Letting those land means the console bangs out an alert for
   * an order that has already been dealt with — which reads as the feature being
   * broken, not as a rounding error.
   *
   * A short fade rather than an abrupt disconnect: killing a running oscillator
   * dead produces a click, and on a till speaker that is more startling than the
   * drum it is replacing.
   */
  stopAll: () => void;
  /**
   * Whether a gesture has ever armed this drum — NOT whether the context
   * happens to be running this instant.
   *
   * The distinction is the whole fix for "no sound while the console sits in a
   * background tab". Chrome suspends a hidden tab's AudioContext once it has
   * been silent for a while, so a state check here would report false for a
   * console that is perfectly capable of playing and only needs a resume().
   * Deciding that from the current state made the provider show the "Enable
   * sound" bar — on a tab nobody is looking at — instead of drumming.
   *
   * Armed is a one-way latch: recovering from suspension is play()'s job.
   */
  isUnlocked: () => boolean;
  /**
   * True once play() has tried and failed to make the context audible again
   * — the browser refused resume() outright, or resumed into a state that
   * still isn't "running". isUnlocked() alone can't report this: it is a
   * one-way latch on purpose (see its own doc comment), so a caller that
   * only checks isUnlocked() would treat a drum stuck like this as fine and
   * keep silently calling play() forever with nothing coming out of it —
   * which is exactly the "rings for a while, then goes quiet with no sign
   * why" failure this exists to catch. A fresh unlock() (a real tap) is the
   * only way out, same as the very first arm.
   */
  needsReArm: () => boolean;
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
  let needsReArm = false;

  /**
   * Master nodes for phrases that are still sounding, so stopAll() has
   * something to reach. Entries remove themselves on the cleanup timer below,
   * so this holds at most one or two at a time rather than growing with the
   * service.
   */
  const sounding: GainNode[] = [];

  /**
   * One limiter shared by every phrase, downstream of all of them — not one
   * created fresh per schedule() call. The drum repeats every few seconds
   * until an order is accepted (see stopAll's doc comment below), so
   * overlapping runs are the normal case, and only a shared node actually
   * catches the SUM of concurrent runs rather than compressing each one in
   * isolation and still letting the total clip at the destination.
   */
  let compressor: DynamicsCompressorNode | null = null;

  function context(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    ctx = new Ctor();
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-8, ctx.currentTime);
    compressor.knee.setValueAtTime(6, ctx.currentTime);
    compressor.ratio.setValueAtTime(16, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);
    compressor.connect(ctx.destination);
    return ctx;
  }

  /**
   * Schedules one full damru run against a context already known to be
   * running. Split out so the resume path below can reach it too.
   */
  function schedule(audio: AudioContext): void {
    const master = audio.createGain();
    // Was 1.3; pushed further for urgency. Safe past 1.0 only because of the
    // shared compressor below — it's what stands between this and clipping.
    master.gain.setValueAtTime(1.6, audio.currentTime);
    // Through the shared compressor, not straight to destination — see
    // `compressor`'s doc comment above for why it has to be shared.
    master.connect(compressor ?? audio.destination);
    sounding.push(master);

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
    // order for the life of the page — and now that the drum repeats every few
    // seconds until someone accepts, "per order" would be "per four seconds".
    window.setTimeout(() => {
      master.disconnect();
      const at = sounding.indexOf(master);
      if (at !== -1) sounding.splice(at, 1);
    }, (STRIKE_COUNT * STRIKE_GAP + 0.3) * 1000);
  }

  return {
    isUnlocked: () => unlocked,
    needsReArm: () => needsReArm,

    stopAll: () => {
      const audio = ctx;
      if (!audio) return;

      for (const master of sounding) {
        try {
          const now = audio.currentTime;
          master.gain.cancelScheduledValues(now);
          master.gain.setValueAtTime(master.gain.value, now);
          master.gain.linearRampToValueAtTime(0.0001, now + 0.03);
        } catch {
          // Already torn down by its own cleanup timer. Nothing to do.
        }
      }

      // The nodes are left connected for the length of the fade and reaped by
      // the cleanup timers scheduled in schedule(), which is why this only
      // clears the list rather than disconnecting here. Disconnecting mid-ramp
      // is the click this fade exists to avoid.
      sounding.length = 0;
    },

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

      // Latches on, never off. A later unlock() firing while the context
      // happens to be suspended must not disarm a drum that has already been
      // armed once — that would hand the background-tab case straight back to
      // the bug this pair of flags exists to fix.
      if (audio.state === "running") {
        unlocked = true;
        // A real tap always clears this: whatever made resume() fail before
        // (expired sticky activation, most likely), a fresh gesture is the
        // one thing guaranteed to get past it.
        needsReArm = false;
      }
    },

    /**
     * THE BACKGROUND-TAB CASE, which is the one that matters here: a console
     * minimized or sitting behind another tab is exactly where the kitchen
     * needs the drum most, and exactly where the browser is most likely to have
     * suspended the context to save power.
     *
     * Resuming needs no fresh gesture. The unlock already gave this page sticky
     * activation, and that is what a browser checks — it does not require the
     * resume to happen inside the gesture itself. So a suspended context is
     * recoverable right here, at the moment the order lands, rather than
     * something the user has to come back and re-enable.
     *
     * Still a no-op when never armed: without that first gesture, resume() is
     * refused and the console falls back to its "Enable sound" affordance.
     */
    play: () => {
      const audio = context();
      if (!audio || !unlocked) return;

      if (audio.state === "running") {
        needsReArm = false;
        schedule(audio);
        return;
      }

      // ~50ms in practice, against a drum the kitchen hears for the next
      // second — a resumed-then-played alert beats a silent one.
      void audio
        .resume()
        .then(() => {
          if (audio.state === "running") {
            needsReArm = false;
            schedule(audio);
          } else {
            // resume() resolved without an error but the context still isn't
            // running — treat it the same as an outright refusal below.
            needsReArm = true;
          }
        })
        .catch(() => {
          // Refused outright. The alert dialog and the OS notification still
          // stand, and needsReArm() now tells the provider to show "tap to
          // enable sound" again instead of silently retrying forever.
          needsReArm = true;
        });
    },
  };
}

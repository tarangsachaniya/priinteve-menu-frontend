/**
 * Spends a mounted screen's one and only user gesture on arming its audio.
 *
 * ─── The problem this solves ────────────────────────────────────────────────
 *
 * A kitchen tablet and a lobby pickup board are hung on a wall and then never
 * touched again. Browsers only let audio start from a user interaction — and
 * these are exactly the two screens whose entire job is to make a noise. The
 * previous answer was a banner asking someone to tap the screen, on a screen
 * nobody walks up to, which is why it was still sitting there hours later.
 *
 * Typing the PIN to unlock the screen IS an interaction, and it is the one
 * interaction every mounted screen is guaranteed to receive. So it is spent
 * here, and neither screen has to ask for another.
 *
 * ─── What this actually does, and what it does not ──────────────────────────
 *
 * It does not "unlock" the specific AudioContext or <audio> element those
 * screens use later — those objects do not exist yet at PIN time, and unlocking
 * the screen is a router.refresh(), not a page load, so they are created a
 * moment later in the SAME document.
 *
 * That is the point. Chrome and Firefox grant the document a sticky activation
 * once it has been interacted with, and an AudioContext created afterwards
 * starts in "running" rather than "suspended". Touching both APIs here — a
 * context and a media element — is what registers the interaction against both
 * of the two separate policies that govern them.
 *
 * iOS Safari is stricter and may still require a gesture against the specific
 * element. That case is not bypassed and not pretended away: the screens keep
 * their own always-on pointerdown/keydown listeners as the fallback, and they
 * show something only if an alert is genuinely refused later.
 *
 * Nothing here throws or reports failure. Arming is best-effort by nature and a
 * failure has a working fallback; surfacing it at the keypad would put an error
 * about sound in front of someone trying to unlock a screen.
 */

type AudioContextConstructor = typeof AudioContext;

function getAudioContextCtor(): AudioContextConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { webkitAudioContext?: AudioContextConstructor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * MUST be called synchronously from inside a real user gesture — the handler
 * itself, not a promise chained off a network response. Awaiting a fetch first
 * spends the activation and the browser refuses what follows.
 */
export function armScreenAudio(): void {
  if (typeof window === "undefined") return;

  // ── Web Audio: what damru.ts and chime.ts synthesize through ──────────────
  try {
    const Ctor = getAudioContextCtor();
    if (Ctor) {
      const ctx = new Ctor();
      void ctx.resume().catch(() => {});

      // A single silent sample. iOS in particular treats "a buffer was played"
      // as the thing that counts, not merely "resume() was called".
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // Closed again rather than kept: the screens build their own contexts and
      // a second live one would be an idle audio device held open for the life
      // of a screen that runs for weeks. The activation it established outlives
      // it, which is the only part that was wanted.
      window.setTimeout(() => void ctx.close().catch(() => {}), 500);
    }
  } catch {
    // No Web Audio here. The fallback listeners still apply.
  }

  // ── Media element: what an uploaded sound file plays through ──────────────
  // A separate policy from the one above, so it needs its own touch.
  try {
    const el = new Audio();
    el.muted = true;
    void el
      .play()
      .then(() => el.pause())
      .catch(() => {});
  } catch {
    // Same as above: best effort.
  }
}

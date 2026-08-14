/**
 * Speaks a ready order's number aloud, for a guest who is not looking at the
 * wall the moment their number moves column. The chime says "something is
 * ready"; this says which one, so nobody has to walk over and check.
 *
 * Best-effort like the chime in chime.ts: an unsupported browser or a refusal
 * to speak must not break the board, just leave it relying on the flash and
 * the chime alone.
 */

/** One utterance per event rather than one per number — matches the chime's "one event to the room" rule. */
function phraseFor(orderNumbers: number[]): string {
  const [last, ...rest] = [...orderNumbers].reverse();
  const spoken = rest.length === 0 ? `${last}` : `${rest.reverse().join(", ")} and ${last}`;
  const verb = orderNumbers.length === 1 ? "is" : "are";
  return `Order number ${spoken} ${verb} ready for pickup`;
}

export function announceReady(orderNumbers: number[]): void {
  if (orderNumbers.length === 0) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const utterance = new SpeechSynthesisUtterance(phraseFor(orderNumbers));
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

/**
 * How long a ticket has been waiting, for the kitchen display.
 *
 * Separate from minutesAgo() in orders-board.tsx, which is deliberately coarse
 * ("3m ago") because a manager scanning a list of cards does not care about
 * seconds. A cook watching a ticket age towards a service-time promise does —
 * a counter that sits on "3m" for sixty seconds reads as frozen, which on a
 * screen whose entire job is to be trusted at a glance is the wrong signal.
 *
 * `now` is passed in rather than read from Date.now() so one timer can drive
 * every ticket on the screen instead of one timer per ticket.
 */
export function elapsedSince(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  const hours = Math.floor(seconds / 3600);
  return `${hours}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}h`;
}

/** Whole minutes waited, for the colour thresholds on a ticket. */
export function minutesWaiting(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

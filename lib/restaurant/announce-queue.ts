import { cancelSpeech, speak } from "@/lib/restaurant/tts";

/**
 * The announcement queue: one thing speaking at a time, in order, ever.
 *
 * ─── What this replaces, and why ────────────────────────────────────────────
 *
 * This used to be a single chained promise — `queue = queue.then(...)`. It
 * serialized correctly and did nothing else. There was no way to look at it, so
 * a duplicate order event announced twice; no cap, so a burst of ready orders
 * across three languages could queue minutes of speech nobody would wait for;
 * and no timeout, so one clip that never fired `ended` wedged every
 * announcement after it for the life of the page.
 *
 * An explicit array fixes all three because the queue becomes a thing you can
 * inspect: dedupe against it, bound it, and drop from it.
 *
 * ─── The waiting track ──────────────────────────────────────────────────────
 *
 *   enqueue → waiting track starts → text/audio resolved → waiting track STOPS
 *           → announcement plays → next item
 *
 * The waiting track is not an announcement and not an alert: it is a "working
 * on it" bed covering the gap while speech is being fetched, which on a cold
 * cache is a second or two of dead air that reads as "the board is broken".
 *
 * It stops on the audible start of the announcement, driven by the provider's
 * own signal rather than a guessed delay — that is what makes overlap
 * impossible rather than merely unlikely. It also stops on every failure path,
 * which is the case worth being careful about: a bed that keeps looping after
 * a failed announcement is worse than no bed at all. stopWaiting() is
 * idempotent and called unconditionally.
 *
 * This is deliberately NOT where new-order sounds live. Those are alerts, they
 * fire the instant an order arrives, and making them queue behind a speech
 * announcement would delay the one sound a kitchen actually needs to hear.
 * See order-alert-provider.tsx.
 */

export type QueuedAnnouncement = {
  /** Stable identity of the event, used to reject duplicates. */
  orderId: string;
  orderNumber: number;
  name?: string;
  languages: string[];
};

/**
 * Hard cap on pending items.
 *
 * A rush that turns twenty orders READY at once, across three languages, is
 * sixty clips — several minutes of continuous speech, by the end of which every
 * one of those guests has already collected their food. Dropping the overflow
 * is the honest behaviour: the board still flashes and the chime still rings
 * for orders that don't get spoken.
 */
const MAX_QUEUE = 20;

/**
 * How long a spoken announcement blocks a repeat of itself.
 *
 * A window rather than a permanent set, and the reason is order numbers: they
 * reset to 1 daily per restaurant, so "order 7" tomorrow is a different order
 * that must still be announced. Ten minutes comfortably covers every way the
 * same event arrives twice — a poll racing a push, a re-delivered push, a
 * component remounting — while being nowhere near long enough to swallow a
 * genuinely new order that happens to reuse a number.
 *
 * The caller's own "is this new" bookkeeping remains the primary guard (see
 * pickup-display.tsx). This is the safety net underneath it, for the races that
 * bookkeeping cannot see.
 */
const RECENT_TTL_MS = 10 * 60 * 1000;

/** Belt-and-braces bound, for a screen that runs for weeks. */
const MAX_RECENT = 500;

type WaitingTrack = {
  start: () => void;
  stop: () => void;
};

let queue: QueuedAnnouncement[] = [];
let running = false;
/** orderId → when it was queued. Insertion-ordered, so the oldest evicts first. */
const recent = new Map<string, number>();
let waitingTrack: WaitingTrack | null = null;

/**
 * Registers the sound to loop while an announcement is being prepared.
 *
 * Injected rather than imported so this module stays free of any opinion about
 * how the sound is produced — a configured file, a synthesized bed, or nothing
 * at all when a restaurant has set none. Passing null disables it entirely,
 * which is the correct default state rather than an error.
 */
export function setWaitingTrack(track: WaitingTrack | null): void {
  // Stop whatever the old track was doing before forgetting it, or a swap
  // mid-announcement leaves a bed looping with nothing able to stop it.
  waitingTrack?.stop();
  waitingTrack = track;
}

function wasRecentlyAnnounced(orderId: string): boolean {
  const at = recent.get(orderId);
  if (at === undefined) return false;
  if (Date.now() - at < RECENT_TTL_MS) return true;

  // Expired. Dropped on read rather than swept on a timer — the only moment
  // staleness matters is when something asks.
  recent.delete(orderId);
  return false;
}

function remember(orderId: string): void {
  // Delete first so a re-remembered id moves to the back of the insertion
  // order, keeping the eviction below oldest-first.
  recent.delete(orderId);
  recent.set(orderId, Date.now());

  if (recent.size > MAX_RECENT) {
    const oldest = recent.keys().next().value;
    if (oldest !== undefined) recent.delete(oldest);
  }
}

/**
 * Queues one order's announcement, once.
 *
 * Fire-and-forget: returns void and callers do not await it, matching the
 * signature both call sites already use.
 *
 * Duplicates are rejected on orderId against both the pending queue and the
 * recently-spoken list, so a re-delivered push, an overlapping poll, and a poll
 * racing a push all collapse into one announcement.
 */
export function enqueueAnnouncement(item: QueuedAnnouncement): void {
  if (typeof window === "undefined") return;
  if (item.languages.length === 0) return;

  if (wasRecentlyAnnounced(item.orderId)) return;
  if (queue.some((queued) => queued.orderId === item.orderId)) return;

  if (queue.length >= MAX_QUEUE) {
    console.warn(`[announce] queue full (${MAX_QUEUE}) — skipping order ${item.orderNumber}`);
    return;
  }

  queue.push(item);
  // Marked as seen at enqueue rather than after speaking: the point is to stop
  // the SAME EVENT being queued twice, and the window where that happens is
  // while it is still pending.
  remember(item.orderId);

  void drain();
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;

  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      for (const lang of item.languages) {
        // Started before the provider is even chosen: the gap being covered
        // includes resolving which one to use and fetching from it.
        waitingTrack?.start();

        try {
          await speak(
            { lang, orderNumber: item.orderNumber, name: item.name },
            // The one signal that matters — audible start, from the provider
            // itself. Everything about the two not overlapping rests on this.
            () => waitingTrack?.stop(),
          );
        } catch (err) {
          // speak() is documented never to throw, so reaching here means that
          // contract broke. Swallow it anyway: one bad announcement must never
          // take the queue — or the screen polling it — down with it.
          console.error("[announce] speak threw", err);
        } finally {
          // Unconditional, and the reason the bed can never be left looping:
          // failure, timeout and success all pass through here.
          waitingTrack?.stop();
        }
      }
    }
  } finally {
    running = false;
  }
}

/**
 * Drops everything pending and silences anything in flight.
 *
 * For unmount. Without it, a board navigated away from keeps talking about
 * orders on a page nobody is looking at.
 *
 * `recent` is deliberately NOT cleared: it is what stops a remount within the
 * same few minutes re-announcing orders that were already spoken.
 */
export function resetAnnouncementQueue(): void {
  queue = [];
  waitingTrack?.stop();
  cancelSpeech();
}

/**
 * Marks orders as already-announced without speaking them.
 *
 * Called with whatever is already READY when a board mounts, so a refresh
 * mid-service is silent instead of announcing the entire column at once.
 */
export function markAnnounced(orderIds: string[]): void {
  for (const id of orderIds) remember(id);
}

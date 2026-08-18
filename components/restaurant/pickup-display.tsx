"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Minus, Plus, Volume2, WifiOff, X } from "lucide-react";

import type { RestoOrderStatus } from "@/lib/api/enums";
import { createWaitingTrack } from "@/lib/restaurant/alert-sound";
import { announceReady, type AnnounceLanguage } from "@/lib/restaurant/announce";
import { resetAnnouncementQueue, setWaitingTrack } from "@/lib/restaurant/announce-queue";
import { createChime, type Chime } from "@/lib/restaurant/chime";
import { primeVoices } from "@/lib/restaurant/tts";
import { screenLockPath, screenPickupPath } from "@/lib/restaurant/screen-paths";
import { useWakeLock } from "@/lib/restaurant/wake-lock";
import { cn } from "@/lib/utils";

/**
 * The customer pickup board — a TV or tablet on a wall, read from across a room
 * by people waiting for food.
 *
 * WHAT IS ON IT: order numbers and first names, in two columns. Nothing else —
 * no full names, no dishes, no totals, no mobile numbers (see the select in
 * screen.routes.ts, which only ever sends a first name via firstNameOnly()).
 * The number stays the dominant visual element; the name is a smaller,
 * secondary line so it helps a guest confirm their order without competing
 * with the number a room full of strangers reads from across the room.
 *
 * The two columns are "Preparing" (ACCEPTED + PREPARING) and "Ready to collect"
 * (READY). A guest does not need to know the difference between accepted and
 * preparing; they need to know whether to stand up.
 *
 * Light-on-white, not inverted: a lobby is normally lit, and this is the one
 * surface here read from across a room rather than up close.
 */

const POLL_INTERVAL_MS = 5000;

/** Failed polls before the screen admits it. A frozen board that looks fine is worse than one that says so. */
const STALE_AFTER_FAILURES = 3;

/** Second guard on top of the API's six-hour window, so the Ready column cannot fill with yesterday. */
const READY_LIMIT = 12;

const SCALE_KEY = "pv:display:scale";
const CHIME_KEY = "pv:display:chime";

export type PickupOrder = { orderNumber: number; status: RestoOrderStatus; customerName: string };

/**
 * Sized off vmin, not vw. A portrait tablet and a 55" landscape TV produce
 * wildly different results from the same vw figure, and this component has to
 * be legible on both without anyone editing code. The S/M/L toggle then covers
 * the rest, and is remembered per device so a venue tunes it once.
 */
const SCALES = {
  S: "text-[clamp(2rem,7vmin,5rem)]",
  M: "text-[clamp(2.5rem,10vmin,8rem)]",
  L: "text-[clamp(3rem,14vmin,11rem)]",
} as const;

type ScaleKey = keyof typeof SCALES;
const SCALE_ORDER: ScaleKey[] = ["S", "M", "L"];

export function PickupDisplay({
  token,
  restaurantName,
  branch,
  initialOrders,
  initialAnnounceLanguages,
}: {
  token: string;
  restaurantName: string;
  branch: string | null;
  initialOrders: PickupOrder[];
  initialAnnounceLanguages: AnnounceLanguage[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  /**
   * Read fresh out of every poll response rather than re-rendered from props —
   * an owner flipping a language on in Settings should take effect on the next
   * tick, not need this tablet reloaded.
   */
  const announceLanguages = useRef(initialAnnounceLanguages);
  const [stale, setStale] = useState(false);
  const [scale, setScale] = useState<ScaleKey>("M");
  /**
   * Raised only after the chime has actually been refused, never on mount.
   *
   * A board that greeted every lobby with "tap anywhere to turn on ready
   * alerts" was asking for a setup step on a screen mounted on a wall that
   * nobody is meant to touch. The unlock listener below still arms the audio
   * from any stray tap, and the PIN keypad that opened this screen in the first
   * place already counted as one — so in practice this is rarely seen at all.
   */
  const [chimeBlocked, setChimeBlocked] = useState(false);
  const [flashing, setFlashing] = useState<Set<number>>(new Set());

  const chime = useRef<Chime | null>(null);
  const waitingTrack = useRef<ReturnType<typeof createWaitingTrack> | null>(null);
  const failures = useRef(0);
  /**
   * Numbers already seen as READY.
   *
   * SEEDED FROM THE FIRST PAYLOAD WITHOUT CHIMING, and here that is the correct
   * behaviour — unlike in the order alert, where the equivalent seeding pass had
   * to be removed. A wall display that reloads after a power cut must not
   * announce every order that was already sitting ready.
   */
  const announced = useRef<Set<number>>(new Set(initialOrders.filter((o) => o.status === "READY").map((o) => o.orderNumber)));

  useWakeLock();

  if (chime.current === null && typeof window !== "undefined") {
    chime.current = createChime();
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(SCALE_KEY);
    if (stored === "S" || stored === "M" || stored === "L") setScale(stored);
  }, []);

  /**
   * Arms the board's audio the moment it opens, and asks nobody.
   *
   * This screen is unlocked with a PIN keypad (screen-lock.tsx), which is a
   * real user gesture — so by the time this runs the browser has almost always
   * already granted the sticky activation these need. Where it has not, the
   * listener below catches the next tap. Either way nothing is shown about it.
   *
   * primeVoices() is here for the same reason: the installed-voice list loads
   * asynchronously in Chrome, and the first announcement should not be the one
   * that waits for it.
   */
  useEffect(() => {
    primeVoices();
    void chime.current?.unlock();
  }, []);

  /**
   * Registers the bed that loops while an announcement is being prepared.
   *
   * Fetched from the screen's own poll payload rather than the restaurant
   * settings API, because a mounted board has a screen session, not a staff
   * one — see screen.routes.ts. Null (no track configured) leaves the queue
   * silent during the gap, which is exactly how it behaved before.
   */
  useEffect(() => {
    const track = createWaitingTrack();
    setWaitingTrack(track);
    waitingTrack.current = track;
    return () => {
      setWaitingTrack(null);
      resetAnnouncementQueue();
    };
  }, []);

  // Any tap anywhere arms the audio, silently. Unhooked only once the chime is
  // genuinely armed, because unlock() can fail on iOS and a listener that gave
  // up on that first failure would leave the board permanently silent.
  useEffect(() => {
    const sound = chime.current;
    if (!sound) return;

    const unlock = () => {
      void sound.unlock().then(() => {
        if (!sound.isUnlocked()) return;
        setChimeBlocked(false);
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      });
    };

    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const tick = useCallback(async () => {
    try {
      const res = await fetch(screenPickupPath(token), { cache: "no-store" });
      if (res.status === 401 || res.status === 404) {
        // The owner rotated the link or changed the PIN. Re-render on the server
        // so the board turns back into a keypad rather than sitting on stale
        // numbers looking healthy.
        router.refresh();
        return;
      }
      if (!res.ok) throw new Error("bad status");

      const data = (await res.json()) as {
        orders: PickupOrder[];
        announceLanguages: AnnounceLanguage[];
        waitingTrackAudioUrl?: string | null;
      };
      failures.current = 0;
      setStale(false);
      announceLanguages.current = data.announceLanguages;
      // Read fresh out of every poll, same as the languages above: a restaurant
      // uploading a waiting track should not need this tablet reloaded.
      waitingTrack.current?.setSource(data.waitingTrackAudioUrl ?? null);

      const nowReady = data.orders.filter((order) => order.status === "READY");
      const freshOrders = nowReady.filter((order) => !announced.current.has(order.orderNumber));
      const fresh = freshOrders.map((order) => order.orderNumber);

      // Announced first, so a failed render or a re-entrant tick cannot chime
      // twice for the same number.
      for (const number of fresh) announced.current.add(number);
      // Anything no longer on the board can be forgotten, so a number reissued
      // tomorrow still announces.
      const stillPresent = new Set(data.orders.map((order) => order.orderNumber));
      announced.current.forEach((number) => {
        if (!stillPresent.has(number)) announced.current.delete(number);
      });

      setOrders(data.orders);

      if (fresh.length > 0) {
        /**
         * The chime fires immediately now, rather than waiting on the
         * announcement.
         *
         * It used to be held back until the first clip was audible, because the
         * locally-synthesized chime would otherwise beat a clip that still had
         * to be fetched from Sarvam and play a beat ahead of the words naming
         * the order — with a 1.5s timeout as the fallback for when no clip ever
         * came. Neither is needed any more: the announcement queue starts its
         * own waiting track the instant an item is queued, so the gap is
         * covered by design and there is nothing left to race.
         *
         * The chime is the only thing CHIME_KEY silences. Speech used to be
         * silenced along with it — dismissing an annoying beep also dropped
         * every Hindi/Gujarati announcement, which is a much bigger loss than
         * the beep itself. They're independent: a muted board still speaks.
         */
        if (window.localStorage.getItem(CHIME_KEY) !== "off") {
          const sound = chime.current;
          if (sound?.isUnlocked()) {
            sound.play();
            setChimeBlocked(false);
          } else {
            // Only now — an alert that should have been audible was not.
            setChimeBlocked(true);
          }
        }

        // One announcement per order however many flipped at once. Two orders
        // becoming ready in the same five-second window is one event to the
        // room, and the announcement follows the same rule, naming each in turn.
        // The queue is what guarantees they do not talk over each other.
        announceReady(
          freshOrders.map((order) => ({
            // Order numbers reset daily per restaurant, and the queue's dedupe
            // window is minutes — so the number alone identifies this event.
            id: `pickup:${order.orderNumber}`,
            orderNumber: order.orderNumber,
            name: order.customerName,
          })),
          announceLanguages.current,
        );

        setFlashing(new Set(fresh));
        window.setTimeout(() => setFlashing(new Set()), 2800);
      }
    } catch {
      failures.current += 1;
      if (failures.current >= STALE_AFTER_FAILURES) setStale(true);
    }
  }, [token, router]);

  useEffect(() => {
    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [tick]);

  function changeScale(direction: 1 | -1) {
    setScale((prev) => {
      const next = SCALE_ORDER[Math.min(2, Math.max(0, SCALE_ORDER.indexOf(prev) + direction))];
      window.localStorage.setItem(SCALE_KEY, next);
      return next;
    });
  }

  function dismissChimeBar() {
    window.localStorage.setItem(CHIME_KEY, "off");
    setChimeBlocked(false);
  }

  async function lock() {
    await fetch(screenLockPath(token), { method: "POST" }).catch(() => {});
    router.refresh();
  }

  const preparing = orders
    .filter((order) => order.status === "ACCEPTED" || order.status === "PREPARING")
    .map((order) => ({ orderNumber: order.orderNumber, customerName: order.customerName }));
  const ready = orders
    .filter((order) => order.status === "READY")
    .map((order) => ({ orderNumber: order.orderNumber, customerName: order.customerName }))
    .slice(-READY_LIMIT);

  return (
    <main className="flex min-h-screen flex-col gap-4 bg-white p-4 text-neutral-900 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold lg:text-2xl">
          {restaurantName}
          {branch && <span className="ml-2 font-normal text-neutral-500">{branch}</span>}
        </h1>

        <div className="flex items-center gap-2">
          {stale && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              <WifiOff className="size-3.5" />
              Reconnecting…
            </span>
          )}
          {/* Deliberately small and dim. These are set once when the screen is
              mounted and must never compete with the numbers. */}
          <button
            type="button"
            onClick={() => changeScale(-1)}
            aria-label="Smaller text"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => changeScale(1)}
            aria-label="Larger text"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => void lock()}
            aria-label="Lock this screen"
            className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
          >
            <Lock className="size-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 sm:grid-cols-2">
        <Column
          title="Preparing"
          entries={preparing}
          scale={scale}
          tone="muted"
          flashing={flashing}
          empty="Nothing cooking"
        />
        <Column
          title="Ready to collect"
          entries={ready}
          scale={scale}
          tone="ready"
          flashing={flashing}
          empty="Nothing ready yet"
        />
      </div>

      {/*
        Shown only after the browser has actually refused a chime — never on
        mount. This board hangs on a wall and is unlocked with a PIN keypad,
        which already counts as the gesture browsers ask for, so in practice
        this stays hidden. When it does appear it is a real fault worth naming,
        not a setup step.
      */}
      {chimeBlocked && (
        // Amber, not neutral: the kitchen display and the console's own sound
        // prompts (SoundEnableButton) both use this shade for "something about
        // sound needs your attention" — a gray bar here made the same message
        // read as three different levels of urgency depending which screen you
        // were looking at. Kept as a bar with its own dismiss rather than a
        // SoundEnableButton, though: this board is unlocked with a PIN keypad,
        // which already counts as the gesture, so tapping THIS element isn't
        // what arms the chime — any tap anywhere does — and offering a dismiss
        // is what a passive notice needs that a call-to-action button doesn't.
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex items-center gap-2">
            <Volume2 className="size-4 shrink-0" />
            This browser blocked the ready alert — tap the screen once to allow it.
          </span>
          <button
            type="button"
            onClick={dismissChimeBar}
            aria-label="Keep this screen silent"
            className="rounded-lg p-1.5 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-700"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </main>
  );
}

type ColumnEntry = { orderNumber: number; customerName: string };

function Column({
  title,
  entries,
  scale,
  tone,
  flashing,
  empty,
}: {
  title: string;
  entries: ColumnEntry[];
  scale: ScaleKey;
  tone: "muted" | "ready";
  flashing: Set<number>;
  empty: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-3xl border p-4 lg:p-6",
        tone === "ready" ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-neutral-50",
      )}
    >
      <h2
        className={cn(
          "text-lg font-semibold uppercase tracking-wide lg:text-2xl",
          tone === "ready" ? "text-emerald-600" : "text-neutral-500",
        )}
      >
        {title}
      </h2>

      {entries.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-base text-neutral-400 lg:text-xl">
          {empty}
        </p>
      ) : (
        <div className="flex flex-wrap content-start gap-3 lg:gap-4">
          {entries.map(({ orderNumber, customerName }) => (
            <span
              key={orderNumber}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-4 py-2 lg:px-6 lg:py-4",
                tone === "ready" ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-700",
                // motion-safe, so a guest who asked their device for less motion
                // still gets the colour change without the pulse.
                flashing.has(orderNumber) && "motion-safe:animate-ready-flash",
              )}
            >
              {/* Secondary to the number on purpose — capped width so one long
                  name can't widen the chip past what the number needs. */}
              {customerName && (
                <span
                  className={cn(
                    "max-w-[12ch] truncate text-xs font-medium uppercase tracking-wide lg:text-sm",
                    tone === "ready" ? "text-white/80" : "text-neutral-500",
                  )}
                >
                  {customerName}
                </span>
              )}
              <span className={cn("font-bold tabular-nums leading-none", SCALES[scale])}>{orderNumber}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

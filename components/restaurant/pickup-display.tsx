"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Lock, Minus, Plus, Volume2, WifiOff, X } from "lucide-react";

import type { RestoOrderStatus } from "@/lib/api/enums";
import { announceReady, hasVoiceFor, type AnnounceLanguage } from "@/lib/restaurant/announce";
import { createChime, type Chime } from "@/lib/restaurant/chime";
import { screenLockPath, screenPickupPath } from "@/lib/restaurant/screen-paths";
import { useWakeLock } from "@/lib/restaurant/wake-lock";
import { cn } from "@/lib/utils";

/**
 * The customer pickup board — a TV or tablet on a wall, read from across a room
 * by people waiting for food.
 *
 * WHAT IS ON IT: order numbers, in two columns. Nothing else — no names, no
 * dishes, no totals, no mobile numbers. The number printed on the guest's
 * receipt is the whole identifier, and the API does not send anything more
 * (see the select in screen.routes.ts): a board a room full of strangers can
 * read, which also calls out over a speaker, is the wrong place to say who
 * anybody is.
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

const LANGUAGE_LABEL: Record<AnnounceLanguage, string> = { en: "English", hi: "Hindi", gu: "Gujarati" };

export type PickupOrder = { orderNumber: number; status: RestoOrderStatus };

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
  const [needsChimeUnlock, setNeedsChimeUnlock] = useState(false);
  const [flashing, setFlashing] = useState<Set<number>>(new Set());
  /**
   * Enabled languages this device has no speechSynthesis voice for — the
   * board still speaks them (announceReady falls back to English rather than
   * garbling the Devanagari/Gujarati string), but this is what turns "the
   * board sounds wrong" into "here's why and where to fix it" rather than a
   * silent surprise. Owner also sees this per-device in Settings; this is the
   * copy that is actually true of the device running the board.
   */
  const [missingVoiceLanguages, setMissingVoiceLanguages] = useState<AnnounceLanguage[]>([]);
  const [voiceWarningDismissed, setVoiceWarningDismissed] = useState(false);

  const chime = useRef<Chime | null>(null);
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
    if (window.localStorage.getItem(CHIME_KEY) !== "off") setNeedsChimeUnlock(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Voices load asynchronously in Chrome — an empty list on the very first
    // check does not mean the language is missing, only that the browser
    // hasn't reported its voices yet. Re-checking on this event is what keeps
    // that from being a false alarm.
    function recheck() {
      setMissingVoiceLanguages(announceLanguages.current.filter((lang) => !hasVoiceFor(lang)));
    }

    recheck();
    window.speechSynthesis.addEventListener("voiceschanged", recheck);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", recheck);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announceLanguages is a ref; the tick loop below re-runs this same check whenever its value changes.
  }, []);

  // Any tap anywhere arms the audio — the bar below only has to explain why one
  // is needed. Unhooked only once the chime is genuinely armed, because unlock()
  // can fail on iOS and a listener that gave up on that first failure would
  // leave the board permanently silent.
  useEffect(() => {
    const sound = chime.current;
    if (!sound) return;

    const unlock = () => {
      void sound.unlock().then(() => {
        if (!sound.isUnlocked()) return;
        setNeedsChimeUnlock(false);
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

      const data = (await res.json()) as { orders: PickupOrder[]; announceLanguages: AnnounceLanguage[] };
      failures.current = 0;
      setStale(false);
      announceLanguages.current = data.announceLanguages;
      setMissingVoiceLanguages(data.announceLanguages.filter((lang) => !hasVoiceFor(lang)));

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
        // The chime is the only thing CHIME_KEY silences. Speech used to be
        // silenced along with it — dismissing an annoying beep also dropped
        // every Hindi/Gujarati announcement, which is a much bigger loss than
        // the beep itself. They're independent now: a muted board still
        // speaks.
        if (window.localStorage.getItem(CHIME_KEY) !== "off") {
          chime.current?.play();
        }

        // One announcement per order however many flipped at once. Two orders
        // becoming ready in the same five-second window is one event to the
        // room, and the announcement follows the same rule, naming each in turn.
        announceReady(
          freshOrders.map((order) => ({ orderNumber: order.orderNumber })),
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
    setNeedsChimeUnlock(false);
  }

  async function lock() {
    await fetch(screenLockPath(token), { method: "POST" }).catch(() => {});
    router.refresh();
  }

  const preparing = orders
    .filter((order) => order.status === "ACCEPTED" || order.status === "PREPARING")
    .map((order) => ({ orderNumber: order.orderNumber }));
  const ready = orders
    .filter((order) => order.status === "READY")
    .map((order) => ({ orderNumber: order.orderNumber }))
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

      {needsChimeUnlock && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <span className="flex items-center gap-2">
            <Volume2 className="size-4 shrink-0" />
            Tap anywhere on this screen to turn on ready alerts.
          </span>
          <button
            type="button"
            onClick={dismissChimeBar}
            aria-label="Keep this screen silent"
            className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-600"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* This is the only place this check means anything — it reads the
          voices actually installed on the device running the board, not on
          whatever device the owner happens to be holding when they check
          Settings. Session-only dismissal: it comes back on reload, which is
          right for something that is telling you about this device, not
          asking your preference. */}
      {!voiceWarningDismissed && missingVoiceLanguages.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex items-center gap-2">
            <CircleAlert className="size-4 shrink-0" />
            No {missingVoiceLanguages.map((lang) => LANGUAGE_LABEL[lang]).join(" or ")} voice is installed on
            this device, so it announces in English instead. Install it from the Settings page.
          </span>
          <button
            type="button"
            onClick={() => setVoiceWarningDismissed(true)}
            aria-label="Dismiss this warning"
            className="rounded-lg p-1.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </main>
  );
}

type ColumnEntry = { orderNumber: number };

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
          {entries.map(({ orderNumber }) => (
            <span
              key={orderNumber}
              className={cn(
                "flex items-center justify-center rounded-2xl px-4 py-2 lg:px-6 lg:py-4",
                tone === "ready" ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-700",
                // motion-safe, so a guest who asked their device for less motion
                // still gets the colour change without the pulse.
                flashing.has(orderNumber) && "motion-safe:animate-ready-flash",
              )}
            >
              <span className={cn("font-bold tabular-nums leading-none", SCALES[scale])}>{orderNumber}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

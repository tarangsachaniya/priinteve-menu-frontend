"use client";

import { useCallback, useEffect, useState } from "react";
import { Delete, Lock, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { armScreenAudio } from "@/lib/restaurant/screen-audio";
import { screenUnlockPath } from "@/lib/restaurant/screen-paths";
import { cn } from "@/lib/utils";

/**
 * The keypad a mounted screen shows until someone unlocks it.
 *
 * WHY A KEYPAD AND NOT A LOGIN FORM: this is typed by whoever is holding the
 * tablet while they hang it on a wall, and later by a manager unlocking it after
 * a power cut — standing up, one-handed, often on a device with no keyboard
 * attached. Big targets and digits only. A login form here would mean summoning
 * an on-screen keyboard on a screen that will then never be typed into again.
 *
 * The PIN is always 6 digits, so the pad submits itself the moment the sixth
 * digit is typed. No Enter key has to be found.
 *
 * NOTHING HERE DECIDES ANYTHING. The PIN is checked by the server, which is also
 * where the five-attempts-per-fifteen-minutes lockout lives — see
 * screen.routes.ts. A comparison in this file would be a comparison an attacker
 * can read in the page source.
 */

const PIN_MAX = 6;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function ScreenLock({
  token,
  title,
  subtitle,
  onUnlocked,
}: {
  token: string;
  title: string;
  subtitle: string;
  onUnlocked: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (candidate: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(screenUnlockPath(token), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: candidate }),
        });

        if (res.ok) {
          /**
           * The one guaranteed user gesture this screen will ever receive.
           *
           * A kitchen tablet and a lobby TV are mounted on a wall and then not
           * touched again — which is a real problem, because browsers only let
           * audio start from a user interaction, and these are precisely the
           * screens whose whole job is making a noise. Asking for a tap later
           * means a banner on a wall nobody walks up to.
           *
           * Typing the PIN is an interaction, so the audio is armed here and
           * lasts as long as the page does. This is why neither screen has to
           * show an "enable sound" step of its own.
           */
          armScreenAudio();
          onUnlocked();
          return true;
        }

        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const message = typeof data.error === "string" ? data.error : "That PIN is not right";

        setError(message);
        setPin("");
        return false;
      } catch {
        setError("Could not reach the server");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token, onUnlocked],
  );

  // Auto-submit, so the common case is six taps and nothing else.
  useEffect(() => {
    if (busy) return;
    if (pin.length === PIN_MAX) {
      void submit(pin);
    }
  }, [pin, busy, submit]);

  const press = useCallback((digit: string) => {
    setError(null);
    setPin((prev) => (prev.length >= PIN_MAX ? prev : prev + digit));
  }, []);

  const backspace = useCallback(() => {
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  }, []);

  // A physical numpad is common on a till, and ignoring it would be perverse.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key >= "0" && event.key <= "9") {
        press(event.key);
      } else if (event.key === "Backspace") {
        backspace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, backspace]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-ink">
            <Lock className="size-6" />
          </span>
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {/* Dots rather than the digits: a screen being unlocked is usually being
            watched by whoever is standing in the room. */}
        <div className="flex h-6 items-center gap-3" aria-live="polite" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: PIN_MAX }, (_, index) => (
            <span
              key={index}
              className={cn("size-3 rounded-full transition-colors", index < pin.length ? "bg-ink" : "bg-border")}
            />
          ))}
        </div>

        <p className={cn("h-5 text-sm font-medium", error ? "text-destructive" : "text-transparent")}>
          {error ?? "placeholder"}
        </p>

        <div className="grid w-full grid-cols-3 gap-3">
          {KEYS.map((key) => (
            <PadButton key={key} onClick={() => press(key)} disabled={busy}>
              {key}
            </PadButton>
          ))}
          <span />
          <PadButton onClick={() => press("0")} disabled={busy}>
            0
          </PadButton>
          <PadButton onClick={backspace} disabled={busy || pin.length === 0} aria-label="Delete">
            {busy ? <LoaderCircle className="size-6 animate-spin" /> : <Delete className="size-6" />}
          </PadButton>
        </div>
      </div>
    </main>
  );
}

function PadButton({
  children,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-label={ariaLabel}
      // h-16 is not decoration: this is tapped with a thumb by someone standing
      // at a wall, and the default button height is a miss waiting to happen.
      className="h-16 select-none text-2xl font-semibold tabular-nums"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

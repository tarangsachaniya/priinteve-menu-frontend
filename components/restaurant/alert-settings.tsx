"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createAlertSound } from "@/lib/restaurant/alert-sound";
import { createDamru } from "@/lib/restaurant/damru";
import {
  disablePush,
  enablePush,
  getPushState,
  sendTestPush,
  type PushState,
} from "@/lib/restaurant/push-client";

/**
 * Where an owner turns order alerts on for the device in front of them, and —
 * more importantly — where they find out whether it actually worked.
 *
 * Per-device, not per-restaurant, and that is the point: a phone, a till PC and
 * a tablet are three separate subscriptions, each needing its own permission
 * grant from the browser sitting in front of a person. There is nothing here to
 * save; every control takes effect immediately.
 */

const SOUND_PREF_KEY = "pv:resto:alert-sound";

/**
 * Copy for each state, kept together so the wording stays consistent and
 * blame-free. Every message names what to do next rather than what went wrong.
 */
const STATE_COPY: Record<PushState, { label: string; detail: string; tone: string }> = {
  subscribed: {
    label: "Alerts are on for this device",
    detail: "New orders will ring here even if this window is minimized or closed.",
    tone: "bg-emerald-500/10 text-emerald-700",
  },
  default: {
    label: "Alerts are off for this device",
    detail: "Turn them on to be told about orders when you're not looking at this screen.",
    tone: "bg-amber-500/10 text-amber-800",
  },
  denied: {
    label: "Notifications are blocked",
    detail:
      "Your browser is blocking notifications for this site. Allow them in site settings — the padlock icon in the address bar — then reload this page.",
    tone: "bg-destructive/10 text-destructive",
  },
  unsupported: {
    label: "This browser can't show order alerts",
    detail:
      "On an iPhone or iPad, add this page to your Home Screen first — Share, then Add to Home Screen — and open it from there.",
    tone: "bg-muted text-muted-foreground",
  },
  unavailable: {
    label: "Alerts aren't set up on the server yet",
    detail: "Ask your administrator to configure push notifications.",
    tone: "bg-muted text-muted-foreground",
  },
};

export function AlertSettings({
  /**
   * What this console will actually play — the restaurant's own upload, or the
   * platform default, already resolved by the API. Null means no file is
   * configured and the synthesized damru is the intended sound.
   *
   * Passed in rather than fetched: the Settings page already reads
   * /api/restaurant/settings/audio for AudioSettingsForm, and a second request
   * for the same three strings would be able to disagree with the first.
   *
   * It exists because the confirmation below used to play a hardcoded
   * createDamru() — so an owner who had just uploaded a track, flipped this
   * switch to check it, and heard the drum, had every reason to conclude the
   * upload had not taken. The switch is the most natural place to test the
   * sound, so it has to be the real one.
   */
  orderSoundUrl = null,
}: {
  orderSoundUrl?: string | null;
} = {}) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    void getPushState().then(setState);
    setSound(window.localStorage.getItem(SOUND_PREF_KEY) !== "off");
  }, []);

  async function toggleAlerts() {
    setBusy(true);
    try {
      if (state === "subscribed") {
        await disablePush();
        setState("default");
        toast.success("Order alerts turned off for this device");
        return;
      }

      const result = await enablePush();
      if (!result.ok) {
        toast.error(result.reason ?? "Couldn't turn on order alerts");
        setState(await getPushState());
        return;
      }

      setState("subscribed");
      toast.success("Order alerts are on for this device");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    try {
      const result = await sendTestPush();
      if (!result.ok) {
        toast.error(result.reason ?? "Couldn't send a test alert");
        return;
      }
      if (result.sent === 0) {
        toast.error("No devices are registered yet — turn alerts on first.");
        return;
      }
      toast.success(
        result.sent === 1 ? "Test alert sent to this device" : `Test alert sent to ${result.sent} devices`,
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleSound(next: boolean) {
    setSound(next);
    window.localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");

    // Play it on the way on, both as confirmation and because this click is a
    // user gesture — which is the only moment the browser will let an
    // AudioContext start, or a media element be marked user-activated. See the
    // autoplay note in lib/restaurant/damru.ts.
    if (next) {
      // Same wrapper the console and the kitchen use, so this preview is the
      // restaurant's configured track when it has one and the synthesized drum
      // only when it does not — never the drum in place of a track.
      const sound = createAlertSound(createDamru());
      sound.setSource(orderSoundUrl);
      void sound.unlock().then(() => sound.play());
    }
  }

  // Nothing until the browser has been asked — rendering "off" first and
  // correcting to "on" a tick later reads as a bug.
  if (state === null) return null;

  const copy = STATE_COPY[state];
  const canToggle = state === "default" || state === "subscribed";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${copy.tone}`}>
          <BellRing className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{copy.label}</p>
            <p className="text-xs opacity-90">{copy.detail}</p>
          </div>
        </div>

        {canToggle && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={toggleAlerts} disabled={busy}>
              <Bell data-icon="inline-start" />
              {state === "subscribed" ? "Turn off on this device" : "Turn on order alerts"}
            </Button>
            {state === "subscribed" && (
              <Button type="button" variant="outline" onClick={test} disabled={busy}>
                Send test alert
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="min-w-0">
            <Label htmlFor="alert-sound" className="flex items-center gap-1.5">
              <Volume2 className="size-4" />
              Alert sound
            </Label>
            <p className="text-xs text-muted-foreground">
              {orderSoundUrl
                ? "Your uploaded track, under Sounds above. Repeats every few seconds until someone accepts or cancels the order."
                : "Repeats every few seconds until someone accepts or cancels the order. Upload your own under Sounds above."}{" "}
              Turning this off leaves the popup and the tab badge — only the sound goes quiet.
            </p>
          </div>
          <Switch id="alert-sound" checked={sound} onCheckedChange={toggleSound} />
        </div>

        {/*
          Both of these get asked about, and both look like bugs when they are
          not explained. The first is a platform limit — a closed browser has no
          page, so there is nothing that can play a custom sound. The second is
          a Chrome setting people turn off without knowing what it does.
        */}
        <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          With the browser fully closed you&apos;ll get your device&apos;s usual notification sound
          rather than your own — the alert sound needs a console window open, in any state,
          including minimized. On Windows, Chrome must also be allowed to keep running in the
          background.
        </p>
      </CardContent>
    </Card>
  );
}

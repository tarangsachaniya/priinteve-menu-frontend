"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DAY_LABELS,
  defaultWeek,
  formatMinutesForInput,
  parseTimeToMinutes,
  resolveOpenState,
  type DayHours,
} from "@/lib/restaurant/hours";

export type HoursSettings = {
  timezone: string;
  acceptingOrders: boolean;
  closedMessage: string | null;
  hours: DayHours[];
};

/**
 * The owner's weekly schedule, plus the manual pause.
 *
 * Two separate controls on purpose. The schedule is the normal week and
 * changes rarely; the pause is for tonight, when the tandoor broke. Folding
 * them together would mean an owner editing Tuesday's hours to shut for an
 * hour and forgetting to put them back.
 */
export function HoursForm({ initial }: { initial: HoursSettings }) {
  const [acceptingOrders, setAcceptingOrders] = useState(initial.acceptingOrders);
  const [closedMessage, setClosedMessage] = useState(initial.closedMessage ?? "");
  const [days, setDays] = useState<DayHours[]>(() =>
    // A restaurant that has never set hours gets a sensible week to edit
    // rather than seven blank rows.
    initial.hours.length === 7 ? [...initial.hours].sort((a, b) => a.dayOfWeek - b.dayOfWeek) : defaultWeek()
  );
  const [isSaving, setIsSaving] = useState(false);

  // The same resolver the customer page uses, so the preview cannot disagree
  // with what a guest would actually see right now.
  const preview = resolveOpenState({
    hours: days,
    timezone: initial.timezone,
    acceptingOrders,
    closedMessage,
  });

  function updateDay(dayOfWeek: number, patch: Partial<DayHours>) {
    setDays((prev) =>
      prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day))
    );
  }

  /** Copies Monday's times onto every other day — the common case by far. */
  function applyMondayToAll() {
    const monday = days.find((day) => day.dayOfWeek === 1);
    if (!monday) return;
    setDays((prev) =>
      prev.map((day) => ({
        ...day,
        opensAt: monday.opensAt,
        closesAt: monday.closesAt,
        isClosed: monday.isClosed,
      }))
    );
    toast.success("Monday's hours copied to every day");
  }

  async function save() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/restaurant/hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptingOrders,
          closedMessage: closedMessage.trim() || null,
          days,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save your hours");
        return;
      }
      toast.success("Opening hours saved");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Taking orders right now</p>
              <p className="text-sm text-muted-foreground">
                Turn this off to stop orders immediately, whatever the schedule says. Your menu
                stays visible.
              </p>
            </div>
            <Switch checked={acceptingOrders} onCheckedChange={setAcceptingOrders} />
          </div>

          {!acceptingOrders && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="closed-message">Message for guests (optional)</Label>
              <Input
                id="closed-message"
                maxLength={120}
                placeholder="Closed for a private event"
                value={closedMessage}
                onChange={(e) => setClosedMessage(e.target.value)}
              />
            </div>
          )}

          <p
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              preview.isOpen
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            Guests currently see: {preview.isOpen ? "Open" : "Closed"} · {preview.label}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Weekly hours</p>
              <p className="text-sm text-muted-foreground">
                Times are in {initial.timezone}. A closing time earlier than the opening time means
                the kitchen runs past midnight.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applyMondayToAll}>
              Copy Monday to all
            </Button>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {days.map((day) => (
              <div
                key={day.dayOfWeek}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <span className="w-24 shrink-0 text-sm font-medium">
                  {DAY_LABELS[day.dayOfWeek]}
                </span>

                {day.isClosed ? (
                  <span className="flex-1 text-sm text-muted-foreground">Closed all day</span>
                ) : (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`${DAY_LABELS[day.dayOfWeek]} opening time`}
                      value={formatMinutesForInput(day.opensAt)}
                      onChange={(e) => {
                        const minutes = parseTimeToMinutes(e.target.value);
                        if (minutes !== null) updateDay(day.dayOfWeek, { opensAt: minutes });
                      }}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      aria-label={`${DAY_LABELS[day.dayOfWeek]} closing time`}
                      value={formatMinutesForInput(day.closesAt)}
                      onChange={(e) => {
                        const minutes = parseTimeToMinutes(e.target.value);
                        if (minutes !== null) updateDay(day.dayOfWeek, { closesAt: minutes });
                      }}
                      className="w-32"
                    />
                  </div>
                )}

                {/* htmlFor + id rather than wrapping the Switch in a <label>,
                    which is the pattern settings-form and menu-item-form use.
                    Switch renders a <button> *and* a hidden checkbox, so a
                    wrapping label had two labelable descendants — invalid, and
                    it leaves which control the label points at up to the
                    browser. */}
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    id={`day-open-${day.dayOfWeek}`}
                    checked={!day.isClosed}
                    onCheckedChange={(open) => updateDay(day.dayOfWeek, { isClosed: !open })}
                  />
                  <Label
                    htmlFor={`day-open-${day.dayOfWeek}`}
                    className="cursor-pointer text-sm font-normal text-muted-foreground"
                  >
                    {/* Seven rows all reading "Open" tell a screen-reader user
                        nothing about which day they are on. The day name is in
                        the accessible name and out of the visual one, where the
                        row heading beside it already says so. */}
                    <span className="sr-only">{DAY_LABELS[day.dayOfWeek]} </span>
                    Open
                  </Label>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" onClick={save} disabled={isSaving} className="self-start">
            {isSaving && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {isSaving ? "Saving…" : "Save hours"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

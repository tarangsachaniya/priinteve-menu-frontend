"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DAY_LABELS,
  formatMinutesForInput,
  parseTimeToMinutes,
} from "@/lib/restaurant/hours";
import {
  MAX_PEAK_WINDOWS_PER_DAY,
  defaultPeakWindows,
  groupByDay,
  resolvePeakState,
  type PeakWindow,
} from "@/lib/restaurant/peak-hours";

export type PeakHoursSettings = {
  timezone: string;
  windows: PeakWindow[];
};

/**
 * When the kitchen is under load.
 *
 * Separate from HoursForm on purpose, even though both edit times of day.
 * Opening hours decide whether an order can be placed at all; these decide
 * only how the menu is ordered while the rush is on. Folding them together
 * would put a control that closes the restaurant next to one that reshuffles
 * a list, and an owner would eventually confuse the two.
 */
export function PeakHoursForm({
  initial,
  demotedDishCount,
}: {
  initial: PeakHoursSettings;
  /** How many dishes are flagged "Hide during rush", for the preview line. */
  demotedDishCount: number;
}) {
  const [days, setDays] = useState<PeakWindow[][]>(() => groupByDay(initial.windows));
  const [isSaving, setIsSaving] = useState(false);

  const flat = days.flat();

  // The same resolver the customer menu uses, so this line cannot claim the
  // restaurant is quiet while guests are being served a reordered menu.
  const preview = resolvePeakState({ windows: flat, timezone: initial.timezone });

  function updateWindow(dayOfWeek: number, index: number, patch: Partial<PeakWindow>) {
    setDays((prev) =>
      prev.map((windows, day) =>
        day === dayOfWeek
          ? windows.map((window, i) => (i === index ? { ...window, ...patch } : window))
          : windows
      )
    );
  }

  function addWindow(dayOfWeek: number) {
    setDays((prev) =>
      prev.map((windows, day) => {
        if (day !== dayOfWeek) return windows;
        // The first window on a day starts as lunch, the second as dinner —
        // the pair almost every kitchen means. Beyond that there is no obvious
        // guess, so a blank-ish row is honest.
        const suggested = defaultPeakWindows(dayOfWeek);
        const next = suggested[windows.length] ?? {
          dayOfWeek,
          startsAt: 1170,
          endsAt: 1350,
          label: null,
        };
        return [...windows, next];
      })
    );
  }

  function removeWindow(dayOfWeek: number, index: number) {
    setDays((prev) =>
      prev.map((windows, day) =>
        day === dayOfWeek ? windows.filter((_, i) => i !== index) : windows
      )
    );
  }

  /** Copies Monday's windows onto every other day — the common case by far. */
  function applyMondayToAll() {
    const monday = days[1];
    setDays((prev) =>
      prev.map((_, dayOfWeek) => monday.map((window) => ({ ...window, dayOfWeek })))
    );
    toast.success("Monday's rush hours copied to every day");
  }

  async function save() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/restaurant/peak-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windows: flat }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save your rush hours");
        return;
      }
      toast.success("Rush hours saved");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">Rush hours</p>
            <p className="text-sm text-muted-foreground">
              Times are in {initial.timezone}. During a rush, dishes you marked &ldquo;Hide during
              rush&rdquo; move to the last page of your menu. Nothing else changes — the kitchen
              stays open and prices stay the same.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={applyMondayToAll}>
            Copy Monday to all
          </Button>
        </div>

        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            preview.isPeak ? "bg-amber-500/10 text-amber-700" : "bg-muted text-muted-foreground"
          }`}
        >
          {preview.isPeak
            ? `Right now: rush on (${preview.label}) · ${demotedDishCount} ${
                demotedDishCount === 1 ? "dish" : "dishes"
              } moved to the last page`
            : "Right now: no rush · your menu is in its usual order"}
        </p>

        {demotedDishCount === 0 && flat.length > 0 && (
          <p className="text-sm text-muted-foreground">
            No dishes are flagged yet, so these windows have nothing to do. Turn on &ldquo;Hide
            during rush&rdquo; on a dish in Menu to use them.
          </p>
        )}

        <div className="flex flex-col divide-y divide-border">
          {days.map((windows, dayOfWeek) => (
            <div key={dayOfWeek} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{DAY_LABELS[dayOfWeek]}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={windows.length >= MAX_PEAK_WINDOWS_PER_DAY}
                  onClick={() => addWindow(dayOfWeek)}
                >
                  <Plus data-icon="inline-start" /> Add rush
                </Button>
              </div>

              {windows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rush</p>
              ) : (
                windows.map((window, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`${DAY_LABELS[dayOfWeek]} rush ${index + 1} start`}
                      value={formatMinutesForInput(window.startsAt)}
                      onChange={(e) => {
                        const minutes = parseTimeToMinutes(e.target.value);
                        if (minutes !== null) updateWindow(dayOfWeek, index, { startsAt: minutes });
                      }}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      aria-label={`${DAY_LABELS[dayOfWeek]} rush ${index + 1} end`}
                      value={formatMinutesForInput(window.endsAt)}
                      onChange={(e) => {
                        const minutes = parseTimeToMinutes(e.target.value);
                        if (minutes !== null) updateWindow(dayOfWeek, index, { endsAt: minutes });
                      }}
                      className="w-32"
                    />
                    <Input
                      value={window.label ?? ""}
                      onChange={(e) => updateWindow(dayOfWeek, index, { label: e.target.value })}
                      placeholder="Lunch rush"
                      maxLength={40}
                      aria-label={`${DAY_LABELS[dayOfWeek]} rush ${index + 1} name`}
                      className="min-w-[120px] flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${DAY_LABELS[dayOfWeek]} rush ${index + 1}`}
                      onClick={() => removeWindow(dayOfWeek, index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))
              )}
            </div>
          ))}
        </div>

        <Button type="button" onClick={save} disabled={isSaving} className="self-start">
          {isSaving && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {isSaving ? "Saving…" : "Save rush hours"}
        </Button>
      </CardContent>
    </Card>
  );
}

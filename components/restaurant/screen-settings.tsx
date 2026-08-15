"use client";

import { useState } from "react";
import {
  ChefHat,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  KeyRound,
  Monitor,
  RefreshCw,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ANNOUNCE_LANGUAGES, type AnnounceLanguage } from "@/lib/restaurant/announce";
import { getKitchenScreenUrl, getPickupDisplayUrl } from "@/lib/restaurant/qr-url";

// Derived from the single source of truth in announce.ts, so this picker can
// never drift out of sync with what the board can actually speak.
const LANGUAGE_LABEL = Object.fromEntries(
  ANNOUNCE_LANGUAGES.map(({ code, label }) => [code, label]),
) as Record<AnnounceLanguage, string>;
/** The full set of languages the board can speak — not a speaking order (that's `announceLanguages`'s own array order now, set by the reorder controls below). */
const ALL_LANGUAGES: AnnounceLanguage[] = ANNOUNCE_LANGUAGES.map(({ code }) => code);

/**
 * The owner's controls for the two unattended screens.
 *
 * One PIN, two links. That split is the security model: the link is possession
 * (it lives on the device), the PIN is knowledge (it lives with the staff), and
 * a screen needs both. Losing a tablet costs you one link; a PIN written on a
 * whiteboard costs you nothing on its own.
 *
 * Every control here takes effect immediately — no save button, same as the
 * order-alert card above it.
 */

type ScreenKind = "KITCHEN" | "PICKUP";

export function ScreenSettings({
  initialKitchenToken,
  initialDisplayToken,
  initialPinSet,
  initialAnnounceLanguages,
}: {
  initialKitchenToken: string | null;
  initialDisplayToken: string | null;
  initialPinSet: boolean;
  initialAnnounceLanguages: AnnounceLanguage[];
}) {
  const [kitchenToken, setKitchenToken] = useState(initialKitchenToken);
  const [displayToken, setDisplayToken] = useState(initialDisplayToken);
  const [pinSet, setPinSet] = useState(initialPinSet);
  // Falls back rather than trusting the prop outright — every .length read
  // below would otherwise crash the whole Settings page for a restaurant
  // row that somehow reached this without the field set.
  const [announceLanguages, setAnnounceLanguages] = useState(initialAnnounceLanguages ?? ["en"]);
  const [languageBusy, setLanguageBusy] = useState(false);

  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<
    { kind: ScreenKind; action: "rotate" | "revoke" } | { kind: "PIN"; action: "clear" } | null
  >(null);

  const pinValid = /^\d{6}$/.test(pin);

  async function savePin() {
    if (!pinValid) return;
    setBusy(true);
    try {
      const res = await fetch("/api/restaurant/settings/screen-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save the PIN");
        return;
      }
      setPinSet(true);
      setPin("");
      toast.success(
        pinSet ? "PIN changed — every mounted screen has been signed out" : "Screen PIN set",
      );
    } finally {
      setBusy(false);
    }
  }

  async function clearPin() {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurant/settings/screen-pin", { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not remove the PIN");
        return;
      }
      setPinSet(false);
      toast.success("PIN removed — both screens are now locked out");
    } finally {
      setBusy(false);
    }
  }

  async function changeLink(kind: ScreenKind, action: "create" | "revoke") {
    setBusy(true);
    try {
      const res = await fetch("/api/restaurant/settings/screen-link", {
        method: action === "create" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        kitchenToken?: string | null;
        displayToken?: string | null;
        error?: unknown;
      };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not update the link");
        return;
      }
      setKitchenToken(data.kitchenToken ?? null);
      setDisplayToken(data.displayToken ?? null);
      toast.success(
        action === "create" ? "New link created — update every screen using the old one" : "Screen turned off",
      );
    } finally {
      setBusy(false);
    }
  }

  /**
   * Same immediate-effect pattern as the PIN and links above: every change
   * PATCHes straight away, optimistically, and rolls back on failure. Shared
   * by toggling a language on/off and by the reorder arrows below — both are
   * just "here's the new array", and the array's own order is what the board
   * speaks in now (see announce.ts), so there's nothing else to persist.
   */
  async function reorder(next: AnnounceLanguage[]) {
    const prev = announceLanguages;
    setAnnounceLanguages(next);
    setLanguageBusy(true);
    try {
      const res = await fetch("/api/restaurant/settings/announce-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languages: next }),
      });
      if (!res.ok) {
        setAnnounceLanguages(prev);
        toast.error("Could not update the announcement languages");
      }
    } finally {
      setLanguageBusy(false);
    }
  }

  /** Unchecking the last enabled language is refused client-side — the API rejects an empty list too, but catching it here avoids a round trip for something the UI can already see is invalid. */
  async function toggleLanguage(lang: AnnounceLanguage, checked: boolean) {
    const next = checked ? [...announceLanguages, lang] : announceLanguages.filter((l) => l !== lang);
    if (next.length === 0) {
      toast.error("At least one language has to stay on");
      return;
    }
    void reorder(next);
  }

  /** Swaps an enabled language with its neighbour — its row position is its speaking priority, so moving it is the entire mechanism for changing which language speaks first. */
  function moveLanguage(lang: AnnounceLanguage, direction: -1 | 1) {
    const index = announceLanguages.indexOf(lang);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= announceLanguages.length) return;
    const next = [...announceLanguages];
    [next[index], next[target]] = [next[target], next[index]];
    void reorder(next);
  }

  function confirmed() {
    const pending = confirming;
    setConfirming(null);
    if (!pending) return;

    if (pending.kind === "PIN") {
      void clearPin();
      return;
    }
    void changeLink(pending.kind, pending.action === "rotate" ? "create" : "revoke");
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-5 p-5">
          {/* ── PIN ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2.5">
            <Label htmlFor="screen-pin" className="flex items-center gap-1.5">
              <KeyRound className="size-4" />
              Screen PIN
            </Label>
            <p className="text-xs text-muted-foreground">
              6 digits, typed once on each screen when you put it up. Changing it signs every
              screen out immediately — that&apos;s how you revoke a device you can&apos;t get back to.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="screen-pin"
                // Text, not number: a number input strips leading zeros, so 0412
                // would silently become 412 and never unlock anything.
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                placeholder={pinSet ? "Enter a new PIN" : "Choose a PIN"}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-40 tabular-nums"
              />
              <Button type="button" onClick={() => void savePin()} disabled={busy || !pinValid}>
                {pinSet ? "Change PIN" : "Set PIN"}
              </Button>
              {pinSet && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setConfirming({ kind: "PIN", action: "clear" })}
                >
                  Remove
                </Button>
              )}
            </div>
            {pin.length > 0 && !pinValid && (
              <p className="text-xs font-medium text-destructive">The PIN must be exactly 6 digits.</p>
            )}
            {!pinSet && (
              <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-800">
                No PIN is set, so neither screen can be opened yet — even with its link.
              </p>
            )}
          </div>

          <ScreenLinkRow
            icon={ChefHat}
            title="Kitchen screen"
            description="Live tickets with a button to accept and cook them. For a tablet by the pass."
            url={kitchenToken ? getKitchenScreenUrl(kitchenToken) : null}
            busy={busy}
            onCreate={() => void changeLink("KITCHEN", "create")}
            onRotate={() => setConfirming({ kind: "KITCHEN", action: "rotate" })}
            onRevoke={() => setConfirming({ kind: "KITCHEN", action: "revoke" })}
          />

          <ScreenLinkRow
            icon={Monitor}
            title="Pickup board"
            description="Order numbers and first names, in two columns, for a screen guests can see. No full names, no prices."
            url={displayToken ? getPickupDisplayUrl(displayToken) : null}
            busy={busy}
            onCreate={() => void changeLink("PICKUP", "create")}
            onRotate={() => setConfirming({ kind: "PICKUP", action: "rotate" })}
            onRevoke={() => setConfirming({ kind: "PICKUP", action: "revoke" })}
          />

          <div className="flex flex-col gap-2.5 border-t border-border pt-5">
            <Label className="flex items-center gap-1.5">
              <Volume2 className="size-4" />
              Pickup announcements
            </Label>
            <p className="text-xs text-muted-foreground">
              When an order goes Ready, the pickup board reads its number aloud in every language
              turned on below, in this order — top to bottom. Use the arrows to change which one
              speaks first.
            </p>
            <div className="flex flex-col gap-1.5">
              {announceLanguages.map((lang, index) => (
                <div key={lang} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                  <span className="w-5 text-center text-xs font-medium text-muted-foreground">{index + 1}</span>
                  <span className="flex-1 text-sm">{LANGUAGE_LABEL[lang]}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={languageBusy || index === 0}
                    aria-label={`Move ${LANGUAGE_LABEL[lang]} earlier`}
                    onClick={() => moveLanguage(lang, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={languageBusy || index === announceLanguages.length - 1}
                    aria-label={`Move ${LANGUAGE_LABEL[lang]} later`}
                    onClick={() => moveLanguage(lang, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={languageBusy}
                    aria-label={`Turn off ${LANGUAGE_LABEL[lang]}`}
                    onClick={() => void toggleLanguage(lang, false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            {announceLanguages.length < ALL_LANGUAGES.length && (
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_LANGUAGES.filter((lang) => !announceLanguages.includes(lang)).map((lang) => (
                  <Button
                    key={lang}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={languageBusy}
                    onClick={() => void toggleLanguage(lang, true)}
                  >
                    + {LANGUAGE_LABEL[lang]}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
            Neither screen signs in as staff, so nobody can reach your settings, history or takings
            from a device on the wall. Treat each link like a key: anyone holding it still needs the
            PIN, but there is no reason to post it anywhere public.
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        variant="destructive"
        title={
          confirming?.kind === "PIN"
            ? "Remove the screen PIN?"
            : confirming?.action === "rotate"
              ? "Create a new link?"
              : "Turn this screen off?"
        }
        description={
          confirming?.kind === "PIN"
            ? "Both screens stop working straight away and stay locked until you set a new PIN."
            : confirming?.action === "rotate"
              ? "The current link stops working immediately. Every screen using it will need the new one typed in."
              : "The link stops working immediately and any screen showing it goes blank. You can create a new link later."
        }
        confirmLabel={
          confirming?.kind === "PIN" ? "Remove PIN" : confirming?.action === "rotate" ? "Create new link" : "Turn off"
        }
        onConfirm={confirmed}
      />
    </>
  );
}

function ScreenLinkRow({
  icon: Icon,
  title,
  description,
  url,
  busy,
  onCreate,
  onRotate,
  onRevoke,
}: {
  icon: typeof ChefHat;
  title: string;
  description: string;
  url: string | null;
  busy: boolean;
  onCreate: () => void;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — select the link and copy it by hand");
    }
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-border pt-5">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon className="size-4" />
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {url === null ? (
        <div>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCreate}>
            Create a link
          </Button>
        </div>
      ) : (
        <>
          {/* Readonly input rather than a <p>: it is selectable, scrollable on a
              narrow screen, and long-pressable to copy on a phone. */}
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
              <Copy data-icon="inline-start" />
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<a href={url} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink data-icon="inline-start" />
              Open
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRotate}>
              <RefreshCw data-icon="inline-start" />
              New link
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRevoke}>
              <Trash2 data-icon="inline-start" />
              Turn off
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


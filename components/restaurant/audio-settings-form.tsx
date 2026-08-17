"use client";

import { useRef, useState } from "react";
import { RotateCcw, Upload, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { uploadDirect } from "@/lib/upload";

/**
 * The three replaceable sounds, each configured on its own.
 *
 * ─── Why three separate blocks and not one with a dropdown ──────────────────
 *
 * The kitchen sound and the restaurant sound are two rooms hearing the same
 * event, and the entire point of the feature is that they can differ. A single
 * control with a "which screen?" selector would make it possible to set one
 * while believing you had set the other — which is the exact mistake the
 * feature exists to make impossible. Three blocks, three states on screen at
 * once, nothing shared between them.
 *
 * ─── Where the bytes go ─────────────────────────────────────────────────────
 *
 * Straight from the browser to S3 via a presigned POST, never through this app
 * or the API (uploadDirect, lib/upload.ts). The presign pins the content type
 * and a size range that S3 itself enforces, and the object key is built
 * server-side from the session's restaurant id — so the filename a user picked
 * is never read by anything, which is what makes path traversal impossible here
 * rather than something to sanitise for.
 *
 * `downscale: false` matters: uploadDirect's default path re-encodes images, and
 * while it no-ops on non-image types, an alert sound must not be anywhere near
 * that code path by accident.
 */

export type AudioKind = "KITCHEN_ORDER" | "RESTAURANT_ORDER" | "WAITING_TRACK";

export type AudioSettings = {
  kitchenOrderAudioUrl: string | null;
  restaurantOrderAudioUrl: string | null;
  waitingTrackAudioUrl: string | null;
  overrides: {
    kitchenOrderAudioUrl: string | null;
    restaurantOrderAudioUrl: string | null;
    waitingTrackAudioUrl: string | null;
  };
};

const BLOCKS: {
  kind: AudioKind;
  field: keyof AudioSettings["overrides"];
  title: string;
  description: string;
}[] = [
  {
    kind: "KITCHEN_ORDER",
    field: "kitchenOrderAudioUrl",
    title: "Kitchen new-order sound",
    description: "Plays on the kitchen display when an order arrives.",
  },
  {
    kind: "RESTAURANT_ORDER",
    field: "restaurantOrderAudioUrl",
    title: "Restaurant new-order sound",
    description: "Plays in this console when an order arrives. Independent of the kitchen sound.",
  },
  {
    kind: "WAITING_TRACK",
    field: "waitingTrackAudioUrl",
    title: "Announcement waiting track",
    description:
      "Loops while a pickup announcement is being prepared, and stops the moment it starts speaking. Not an alert.",
  },
];

export function AudioSettingsForm({
  /** Base path — "/api/restaurant/settings/audio" or the admin equivalent. */
  endpoint,
  initial,
}: {
  endpoint: string;
  initial: AudioSettings;
}) {
  const [settings, setSettings] = useState(initial);

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Volume2 className="size-4" />
          Alert sounds
        </CardTitle>
        <CardDescription>
          Upload your own, or leave any of them empty to use the built-in sound.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {BLOCKS.map((block) => (
          <AudioBlock
            key={block.kind}
            endpoint={endpoint}
            kind={block.kind}
            title={block.title}
            description={block.description}
            /** The restaurant's OWN file, not the resolved one — "Reset" has to
             *  be offered for something this restaurant actually set. */
            currentUrl={settings.overrides[block.field]}
            /** What is actually heard today, which may be a platform default. */
            effectiveUrl={settings[block.field]}
            onChanged={setSettings}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function AudioBlock({
  endpoint,
  kind,
  title,
  description,
  currentUrl,
  effectiveUrl,
  onChanged,
}: {
  endpoint: string;
  kind: AudioKind;
  title: string;
  description: string;
  currentUrl: string | null;
  effectiveUrl: string | null;
  onChanged: (next: AudioSettings) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setProgress(0);
    try {
      const uploaded = await uploadDirect(file, `${endpoint}/upload-url`, {
        extra: { kind },
        onProgress: setProgress,
        // Never near the image re-encoder. See the note at the top of the file.
        downscale: false,
      });

      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, url: uploaded.url as string }),
      });
      if (!res.ok) {
        toast.error("Uploaded, but could not be saved. Try again.");
        return;
      }

      onChanged((await res.json()) as AudioSettings);
      toast.success(`${title} updated`);
    } catch (err) {
      // uploadDirect turns S3's XML errors into something a restaurant owner
      // can act on ("That file is 8.2MB — the limit is 5.0MB").
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      const res = await fetch(`${endpoint}/${kind}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not reset the sound");
        return;
      }
      onChanged((await res.json()) as AudioSettings);
      toast.success(`${title} reset to default`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-4">
      <div>
        <Label className="text-sm font-semibold">{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <p className="text-xs text-muted-foreground">
        {currentUrl
          ? "Using your uploaded sound."
          : effectiveUrl
            ? "Using the platform default."
            : "Using the built-in sound."}
      </p>

      {/* The preview is the effective sound, so it answers the question an owner
          actually has — "what will I hear?" — rather than "what did I upload?".
          Native controls: this is one short clip, and a bespoke player would be
          a worse version of something every browser already ships. */}
      {effectiveUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio src={effectiveUrl} controls preload="none" className="w-full max-w-sm" />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          // Reset so re-picking the same file fires change again.
          e.target.value = "";
        }}
      />

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload data-icon="inline-start" />
          {currentUrl ? "Replace" : "Upload"}
        </Button>

        {currentUrl && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void reset()}>
            <RotateCcw data-icon="inline-start" />
            Reset to default
          </Button>
        )}

        {busy && (
          <span className="text-xs text-muted-foreground">
            {progress > 0 && progress < 100 ? `Uploading ${progress}%` : "Working…"}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">MP3, WAV, OGG, M4A or AAC · up to 5MB</p>
    </div>
  );
}

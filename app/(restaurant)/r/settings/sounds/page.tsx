import { serverFetch } from "@/lib/api/server";
import { AlertSettings } from "@/components/restaurant/alert-settings";
import { AudioSettingsForm, type AudioSettings } from "@/components/restaurant/audio-settings-form";

export const dynamic = "force-dynamic";

export default async function SoundsSettingsPage() {
  const audio = await serverFetch<AudioSettings>("/api/restaurant/settings/audio", {
    cache: "no-store",
  }).catch(() => null);

  return (
    <div className="flex flex-col gap-10">
      {audio && <AudioSettingsForm endpoint="/api/restaurant/settings/audio" initial={audio} />}

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Order alerts</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Ring this device when an order comes in, so nobody has to watch the board. Set up each
          phone, tablet and till separately — they each need their own permission.
        </p>
        {/* The resolved restaurant-order sound, so the confirmation this switch
            plays is the one an order will actually make. Never the kitchen's —
            the two are configured separately and this is the console. */}
        <AlertSettings orderSoundUrl={audio?.restaurantOrderAudioUrl ?? null} />
      </section>
    </div>
  );
}

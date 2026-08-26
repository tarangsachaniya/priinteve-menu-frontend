import { serverFetch } from "@/lib/api/server";
import { DevicesForm } from "@/components/restaurant/settings/devices-form";

export const dynamic = "force-dynamic";

type DevicesResponse = {
  devices: {
    id: string;
    kind: "TV_KITCHEN" | "TV_PICKUP" | "MOBILE" | "PRINTER_BRIDGE";
    name: string;
    platform: string | null;
    lastSeenAt: string | null;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
  }[];
};

export default async function DevicesSettingsPage({
  searchParams,
}: {
  searchParams: { pair?: string };
}) {
  const { devices } = await serverFetch<DevicesResponse>("/api/restaurant/devices", {
    cache: "no-store",
  });

  return <DevicesForm initialDevices={devices} initialCode={searchParams.pair} />;
}

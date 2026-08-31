import { serverFetch } from "@/lib/api/server";
import type { RestoKotPrinterMode, RestoOperationType } from "@/lib/api/enums";
import { PrintingForm, type Printer } from "@/components/restaurant/settings/printing-form";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: { operationType: RestoOperationType; kotPrinterMode: RestoKotPrinterMode | null };
};

type PrintersResponse = { printers: Printer[] };

type DetectedPrintersResponse = { printers: string[] };

/**
 * The restaurant's own printing configuration.
 *
 * operationType (KOT/DBS) and kotPrinterMode (One-Way/Two-Way) both ride
 * along on /api/restaurant/settings — both read-only here, admin-only to
 * change (see restaurant-detail-panel.tsx on the admin side). What renders
 * below the read-only banner depends on them:
 *   - KOT with no kotPrinterMode set yet: a "waiting on your administrator" note.
 *   - KOT + ONE_WAY: one SHARED printer card.
 *   - KOT + TWO_WAY: a BILLING card and a KITCHEN card.
 *   - DBS: one BILLING card.
 * See PrintingForm for how each shape renders.
 */
export default async function PrintingSettingsPage() {
  const [{ restaurant }, { printers }, { printers: detectedPrinters }] = await Promise.all([
    serverFetch<SettingsResponse>("/api/restaurant/settings", { cache: "no-store" }),
    serverFetch<PrintersResponse>("/api/restaurant/printers", { cache: "no-store" }),
    serverFetch<DetectedPrintersResponse>("/api/restaurant/printers/detected", { cache: "no-store" }),
  ]);

  return (
    <PrintingForm
      operationType={restaurant.operationType}
      initialKotPrinterMode={restaurant.kotPrinterMode}
      initialPrinters={printers}
      detectedPrinters={detectedPrinters}
    />
  );
}

import { serverFetch } from "@/lib/api/server";
import type { RestoKotPrinterMode, RestoOperationType } from "@/lib/api/enums";
import { PrintingForm, type Printer } from "@/components/restaurant/settings/printing-form";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: { operationType: RestoOperationType; kotPrinterMode: RestoKotPrinterMode | null };
};

type PrintersResponse = { printers: Printer[] };

/**
 * The restaurant's own printing configuration.
 *
 * operationType (KOT/DBS) rides along on /api/restaurant/settings — it's
 * read-only here, admin-only to change (see restaurant-detail-panel.tsx on
 * the admin side). What renders below the read-only banner depends on it:
 *   - KOT with no kotPrinterMode chosen yet: a One-Way/Two-Way prompt.
 *   - KOT + ONE_WAY: one SHARED printer card.
 *   - KOT + TWO_WAY: a BILLING card and a KITCHEN card.
 *   - DBS: one BILLING card.
 * See PrintingForm for how each shape renders.
 */
export default async function PrintingSettingsPage() {
  const [{ restaurant }, { printers }] = await Promise.all([
    serverFetch<SettingsResponse>("/api/restaurant/settings", { cache: "no-store" }),
    serverFetch<PrintersResponse>("/api/restaurant/printers", { cache: "no-store" }),
  ]);

  return (
    <PrintingForm
      operationType={restaurant.operationType}
      initialKotPrinterMode={restaurant.kotPrinterMode}
      initialPrinters={printers}
    />
  );
}

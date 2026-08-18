import { serverFetch } from "@/lib/api/server";
import {
  InvoiceIdentityForm,
  type InvoiceIdentitySettings,
} from "@/components/restaurant/settings/invoice-identity-form";
import { InvoiceSectionsForm, type InvoiceSection } from "@/components/restaurant/invoice-sections-form";

export const dynamic = "force-dynamic";

type SettingsResponse = {
  restaurant: InvoiceIdentitySettings & { name: string; invoiceSections: InvoiceSection[] };
};

export default async function InvoiceSettingsPage() {
  const { restaurant } = await serverFetch<SettingsResponse>("/api/restaurant/settings", {
    cache: "no-store",
  });

  return (
    <div className="flex flex-col gap-10">
      <InvoiceIdentityForm settings={restaurant} restaurantName={restaurant.name} />

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Invoice sections</h2>
        {/* Defensive: falls back to empty rather than crashing this page if the
            API response is ever missing this field — confirmed live before,
            where a still-deploying API build was omitting invoiceSections
            entirely and InvoiceSectionsForm's useState took the resulting
            undefined at face value. */}
        <InvoiceSectionsForm initial={restaurant.invoiceSections ?? []} />
      </section>
    </div>
  );
}

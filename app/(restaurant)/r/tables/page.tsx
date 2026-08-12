import { redirect } from "next/navigation";
import { Table2 } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import { PageHeader } from "@/components/shared/page-header";
import { TablesManager, type TableRow } from "@/components/restaurant/tables-manager";

export const dynamic = "force-dynamic";

/**
 * The restaurant's own view of its tables.
 *
 * No base URL is resolved here any more, and no QR is rendered: the API sends
 * a restaurant session the label and seat count only, never the code. Printing
 * lives on the admin side — see the API's routes/admin/restaurant-tables.routes.ts.
 */
export default async function RestaurantTablesPage() {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  const { tables } = await serverFetch<{ tables: TableRow[] }>("/api/restaurant/tables", {
    cache: "no-store",
  });

  return (
    <main className="mx-auto max-w-6xl p-6 sm:p-8 lg:p-10">
      <PageHeader
        icon={Table2}
        title="Tables"
        description="Add the tables in your restaurant. Printeve prints a QR Menu Card for each one."
      />

      <TablesManager initialTables={tables} />
    </main>
  );
}

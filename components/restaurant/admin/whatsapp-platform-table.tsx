import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

export type WhatsappRollupRow = {
  restaurantId: string;
  restaurantName: string;
  isEnabled: boolean;
  currentRate: number | null;
  messagesThisMonth: number;
  chargesThisMonth: number;
};

/**
 * The cross-restaurant rollup for the platform-wide /admin/whatsapp page.
 * Purpose-built rather than a reuse of RestaurantsTable — a different, much
 * simpler domain (five columns, no search/filter needed at this scale).
 */
export function WhatsappPlatformTable({ restaurants }: { restaurants: WhatsappRollupRow[] }) {
  if (restaurants.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          No restaurant has WhatsApp configured yet — enable it from a restaurant&apos;s own detail page.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Restaurant</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Messages this month</TableHead>
              <TableHead>Charges this month</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurants.map((row) => (
              <TableRow key={row.restaurantId}>
                <TableCell>
                  <Link href={`/admin/restaurants/${row.restaurantId}`} className="font-medium hover:underline">
                    {row.restaurantName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={row.isEnabled ? "default" : "secondary"}>{row.isEnabled ? "Enabled" : "Disabled"}</Badge>
                </TableCell>
                <TableCell>{row.currentRate !== null ? `${formatCurrency(row.currentRate)} / msg` : "Not set"}</TableCell>
                <TableCell>{row.messagesThisMonth.toLocaleString()}</TableCell>
                <TableCell>{formatCurrency(row.chargesThisMonth)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

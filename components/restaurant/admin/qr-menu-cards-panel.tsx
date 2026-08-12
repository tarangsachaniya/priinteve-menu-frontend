"use client";

import { useState } from "react";
import { Check, Copy, Download, Printer, QrCode, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * QR Menu Cards, from the Priinteve Innovations side.
 *
 * Everything a restaurant used to be able to do to its own codes lives here
 * instead, on the admin restaurant detail page. All of it is served by
 * /api/admin/restaurants/:id/… behind the platform ADMIN guard, so this panel
 * only renders for someone who could call those endpoints directly anyway.
 */

export type AdminTableRow = {
  id: string;
  label: string;
  code: string;
  seats: number | null;
  isActive: boolean;
  orderUrl: string;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused on insecure origins and in some embedded
      // browsers. Say so rather than showing a "Copied" that did not happen.
      toast.error("Couldn't copy — select the link and copy it manually");
    }
  }

  return (
    <Button type="button" variant="outline" size="xs" onClick={copy}>
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function QrCard({
  title,
  subtitle,
  orderUrl,
  imageSrc,
  downloadName,
  badge,
  accent = false,
}: {
  title: string;
  subtitle: string;
  orderUrl: string;
  imageSrc: string;
  downloadName: string;
  badge?: React.ReactNode;
  accent?: boolean;
}) {
  const [showQr, setShowQr] = useState(false);

  return (
    <Card className={accent ? "border-border/80 bg-muted/30" : "border-border/80"}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {accent && (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-ink">
                <ShoppingBag className="size-4" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{title}</p>
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          {badge}
        </div>

        {showQr && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageSrc}
            alt={`QR code for ${title}`}
            className="mx-auto size-40 rounded-xl border border-border bg-white p-2"
          />
        )}

        <p className="break-all text-xs text-muted-foreground">{orderUrl}</p>

        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="xs" onClick={() => setShowQr((v) => !v)}>
            <QrCode data-icon="inline-start" />
            {showQr ? "Hide QR" : "Show QR"}
          </Button>
          <CopyButton value={orderUrl} label="Copy link" />
          <Button variant="outline" size="xs" render={<a href={imageSrc} download={downloadName} />}>
            <Download data-icon="inline-start" />
            PNG
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function QrMenuCardsPanel({
  restaurantId,
  offersTakeaway,
  orderUrl,
  tables,
}: {
  restaurantId: string;
  offersTakeaway: boolean;
  orderUrl: string;
  tables: AdminTableRow[];
}) {
  const base = `/api/admin/restaurants/${restaurantId}`;
  const hasSomethingToPrint = offersTakeaway || tables.some((table) => table.isActive);

  return (
    <Card className="border-border/80">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="size-4" />
            QR Menu Cards
          </CardTitle>
          <CardDescription>
            The restaurant creates its tables; Priinteve Innovations prints the cards. These codes are not
            visible to the restaurant.
          </CardDescription>
        </div>
        {hasSomethingToPrint && (
          <Button
            variant="outline"
            size="sm"
            render={<a href={`${base}/qr-sheet`} target="_blank" rel="noreferrer" />}
          >
            <Printer data-icon="inline-start" />
            Print all
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {offersTakeaway && (
          <QrCard
            accent
            title="Take-away &amp; delivery"
            subtitle="One code for guests ordering without a table."
            orderUrl={orderUrl}
            imageSrc={`${base}/takeaway-qr`}
            downloadName="take-away-qr.png"
          />
        )}

        {tables.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This restaurant hasn&apos;t added any tables yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tables.map((table) => (
              <QrCard
                key={table.id}
                title={table.label}
                subtitle={`${table.seats ? `${table.seats} seats · ` : ""}${table.code}`}
                orderUrl={table.orderUrl}
                imageSrc={`${base}/tables/${table.id}/qr`}
                downloadName={`${table.label.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
                badge={!table.isActive ? <Badge variant="secondary">Retired</Badge> : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

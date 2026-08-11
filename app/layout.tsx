import type { Metadata } from "next";
import "./globals.css";
// After globals.css, not via @import inside it — webpack's css-loader hoists
// @import to the top of the bundle, which would let :root win over the
// [data-resto-theme] scope overrides. Mirrors the card product's app/layout.tsx.
import "./resto-theme.css";
import { restaurantFontVariables } from "@/lib/restaurant/fonts";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Priinteve Menu — QR ordering for restaurants",
  description: "Table-side QR ordering, a live kitchen board, and GST-ready invoices — set up in a day.",
};

/**
 * Unlike Cards (Geist everywhere, restaurant fonts scoped to /order only),
 * this whole app IS the restaurant product — the console, the admin panel,
 * and the guest ordering surface all read the same brand. Outfit/DM Sans are
 * applied here at the root instead of per-route.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", restaurantFontVariables)}>
      <body className={cn(restaurantFontVariables, "antialiased")}>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

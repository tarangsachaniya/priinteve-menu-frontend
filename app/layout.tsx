import type { Metadata } from "next";
import "./globals.css";
// After globals.css, not via @import inside it — webpack's css-loader hoists
// @import to the top of the bundle, which would let :root win over the
// [data-resto-theme] scope overrides. Mirrors the card product's app/layout.tsx.
import "./resto-theme.css";
// Same scoping story as resto-theme.css: everything inside is behind
// [data-marketing], so importing it globally costs one stylesheet and changes
// nothing until the marketing wrapper opts in.
import "./marketing-theme.css";
import { restaurantFontVariables } from "@/lib/restaurant/fonts";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Site-wide metadata and branding.
 *
 * The favicon comes from the app-router file convention rather than from an
 * `icons` block here: app/icon.svg, app/favicon.ico and app/apple-icon.png are
 * picked up automatically and get content-hashed URLs, which is what makes a
 * changed icon actually replace a cached one. All three are the Priinteve
 * Innovations mark — the .ico shipped before this was the unmodified
 * create-next-app default.
 *
 * metadataBase matters more than it looks: without it, the relative image and
 * canonical URLs the per-restaurant pages emit stay relative, and Open Graph
 * consumers need absolute ones. NEXT_PUBLIC_SITE_URL is the deployment origin
 * the printed QR codes already point at.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // No `template` on purpose. A guest page's title has to be the restaurant's
  // name and nothing else competing with it — "Spice Garden · Menu & Online
  // Ordering · Priinteve Menu" spends the 60 characters a search result shows
  // on the platform rather than on the restaurant.
  title: "Priinteve Menu — QR ordering for restaurants",
  description: "Table-side QR ordering, a live kitchen board, and GST-ready invoices — set up in a day.",
  applicationName: "Priinteve Menu",
  /**
   * Not decoration: iOS and iPadOS deliver Web Push only to a site the user has
   * added to their Home Screen, and a site with no manifest cannot be added.
   * Without this line an owner's iPhone silently never rings — the one failure
   * mode of the order alerts that reports itself as nothing at all.
   */
  manifest: "/manifest.webmanifest",
  openGraph: {
    siteName: "Priinteve Menu",
    type: "website",
  },
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
        <Toaster position="top-center" />
      </body>
    </html>
  );
}

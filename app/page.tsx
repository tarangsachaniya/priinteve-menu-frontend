import type { Metadata } from "next";

import { MarketingNavbar } from "@/components/marketing/marketing-navbar";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { ClosingCta, Footer } from "@/components/marketing/footer";

// Fully static — no fetch, no cookies read. The whole point of this page is
// that it never depends on the API being up.
export const revalidate = false;

export const metadata: Metadata = {
  title: "Priinteve Menu — QR ordering for restaurants",
  description: "Table-side QR ordering, a live kitchen board, and GST-ready invoices — set up in a day.",
};

export default function MarketingHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingNavbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <Footer />
    </div>
  );
}

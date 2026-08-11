import { DM_Sans, Outfit } from "next/font/google";

/**
 * Typefaces for the restaurant template.
 *
 * Deliberately not in app/layout.tsx: the card product uses Geist and has no
 * business downloading these. The variables are applied on the /order layout
 * only, which is the whole customer-facing surface.
 *
 * Outfit carries display type — restaurant name, dish names, section titles,
 * totals. DM Sans carries body copy and, importantly, prices: it ships proper
 * tabular figures, which is what keeps a column of dish prices aligned.
 */

export const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

/** Applied together on the /order layout wrapper. */
export const restaurantFontVariables = `${outfit.variable} ${dmSans.variable}`;

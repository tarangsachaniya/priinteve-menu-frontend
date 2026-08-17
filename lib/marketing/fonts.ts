import { Instrument_Serif } from "next/font/google";

/**
 * The landing page's display serif.
 *
 * Deliberately not added to lib/restaurant/fonts.ts: that module's variables
 * are applied to <html> in app/layout.tsx, so anything declared there is
 * fetched on every route including the console and the guest ordering pages.
 * This face is used by exactly two elements on one static page, so it is
 * scoped to the marketing wrapper instead.
 *
 * One weight, one style — italic 400. The mockups use it for a single phrase
 * inside an otherwise grotesk headline; loading a roman it never renders
 * would double the cost for nothing.
 */
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
});

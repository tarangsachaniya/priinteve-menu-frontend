import { dmSans, outfit } from "@/lib/restaurant/fonts";

/**
 * Font scope for every customer-facing restaurant page.
 *
 * The two typefaces are imported here rather than in the root layout so the
 * card product never preloads them — next/font only emits preload hints on
 * routes where the module is imported.
 *
 * They are published as :root custom properties rather than as a wrapper
 * className because the cart and checkout render through a portal into
 * document.body, outside this subtree. A wrapper class would leave those
 * surfaces on the card product's Geist. This mirrors how the palette already
 * reaches portals — see the note in <RestoModeScript>.
 */
const fontVariables = `:root{--font-outfit:${outfit.style.fontFamily};--font-dm-sans:${dmSans.style.fontFamily}}`;

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: fontVariables }} />
      {children}
    </>
  );
}

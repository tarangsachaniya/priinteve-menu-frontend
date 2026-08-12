import { resolveBrandTheme } from "@/lib/restaurant/brand";
import { resolveRestoModeForRender, normalizeRestoMode } from "@/lib/restaurant/theme";

/**
 * Establishes the scope every restaurant token resolves against.
 *
 * The four inline custom properties are the complete per-tenant surface of the
 * design system — everything else in app/resto-theme.css is either locked or
 * derived from --resto-brand in CSS. That is the multi-tenant claim in one
 * place: adding a restaurant sets four strings and changes nothing else.
 *
 * On a customer page (`asPage`) the mode attribute is deliberately NOT set
 * here — <RestoModeScript> already put it on <html> before this markup was
 * parsed, and the tokens inherit down. In previews there is no <html>
 * attribute to inherit from, so the element carries the mode itself.
 */
export function RestoThemeScope({
  brandColor,
  mode,
  asPage = false,
  className,
  children,
}: {
  brandColor: string | null | undefined;
  /** The owner's default. Ignored when `asPage` — the script resolves it live. */
  mode?: string | null;
  asPage?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const brand = resolveBrandTheme(brandColor);

  return (
    <div
      data-resto-theme="menu"
      data-resto-mode={asPage ? undefined : resolveRestoModeForRender(normalizeRestoMode(mode))}
      className={className}
      style={
        {
          "--resto-brand": brand.seed,
          "--on-brand": brand.onBrand,
          "--resto-brand-text-light": brand.textOnLight,
          "--resto-brand-text-dark": brand.textOnDark,
          /**
           * Without this, unstyled text (a bare <h3>, a <span> with no
           * text-* class) inherits `color` from <body>, which is the card
           * product's own near-black --foreground — set once, globally, and
           * never touched by this scope's custom properties. Light resto mode
           * hid the bug: near-black on a near-white panel still reads fine.
           * Dark mode is where it actually breaks — near-black on a 25%-
           * lightness panel is the "text not visible" screenshot.
           */
          color: "var(--resto-text)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

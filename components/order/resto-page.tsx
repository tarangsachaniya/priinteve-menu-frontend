import { RestoModeScript } from "@/components/order/resto-mode-script";
import { RestoThemeScope } from "@/components/order/resto-theme-scope";

/**
 * The wrapper every customer-facing restaurant page needs.
 *
 * Two things have to happen together and in this order: the pre-paint script
 * puts the theme attributes on <html> before anything renders, and the scope
 * publishes the four per-tenant custom properties the tokens derive from.
 * Splitting them across call sites is how the theme ended up applied nowhere
 * at all — every token in app/resto-theme.css was live and resolving against
 * an attribute no route ever set.
 */
export function RestoPage({
  slug,
  brandColor,
  themeMode,
  children,
}: {
  slug: string;
  brandColor: string | null | undefined;
  themeMode: string | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <>
      <RestoModeScript slug={slug} ownerMode={themeMode} />
      <RestoThemeScope brandColor={brandColor} asPage>
        {children}
      </RestoThemeScope>
    </>
  );
}

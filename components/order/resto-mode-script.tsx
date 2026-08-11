import { normalizeRestoMode, restoModeStorageKey } from "@/lib/restaurant/theme";

/**
 * Applies the theme scope and the guest's remembered mode to <html> before the
 * menu below it is parsed, so a restaurant defaulting to dark never flashes
 * white for a guest who chose light — or the reverse.
 *
 * Must be rendered as the FIRST child of the page: inline scripts block
 * parsing and run synchronously, so nothing has painted when it runs. It must
 * not reference anything from the bundle; this executes long before hydration.
 *
 * Setting the attributes on <html> rather than on the scope element is what
 * makes mode switching flash-free, and it also means portalled UI — the
 * checkout sheet renders into document.body, outside the menu markup — still
 * resolves the restaurant palette.
 *
 * Precedence: guest override (localStorage, per restaurant) > owner default >
 * system preference.
 */
export function RestoModeScript({
  slug,
  ownerMode,
}: {
  slug: string;
  ownerMode: string | null | undefined;
}) {
  const mode = normalizeRestoMode(ownerMode);
  const key = restoModeStorageKey(slug);

  const script = [
    "(function(){try{",
    "var r=document.documentElement;",
    'r.setAttribute("data-resto-theme","menu");',
    `var s=localStorage.getItem(${JSON.stringify(key)});`,
    'var m=(s==="light"||s==="dark")?s:',
    `(${JSON.stringify(mode)}==="system"`,
    '?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")',
    `:${JSON.stringify(mode === "light" ? "light" : "dark")});`,
    'r.setAttribute("data-resto-mode",m);',
    "}catch(e){}})();",
  ].join("");

  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />;
}

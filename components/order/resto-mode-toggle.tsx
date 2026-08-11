"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { restoModeStorageKey, type ResolvedRestoMode } from "@/lib/restaurant/theme";

/**
 * Lets a guest override the restaurant's light/dark default.
 *
 * Switching flips the attribute on <html> directly. Every token is a custom
 * property keyed off that attribute, so the whole page repaints instantly with
 * no re-render, no refetch and no reload.
 */
export function RestoModeToggle({ slug, ownerMode }: { slug: string; ownerMode: string }) {
  // Rendered only after mount: the true mode lives on <html> (set pre-paint by
  // RestoModeScript), which the server cannot know, so rendering an icon during
  // SSR would guarantee a hydration mismatch and a wrong icon on first paint.
  const [mode, setMode] = useState<ResolvedRestoMode | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-resto-mode");
    if (current === "light" || current === "dark") {
      setMode(current);
      return;
    }

    // No attribute means the pre-paint script didn't run. The stylesheet paints
    // its light base in that case, so report light — the old fallback said
    // "dark", which put a moon on a white page and made the first tap look
    // broken: it switched to the mode already showing.
    document.documentElement.setAttribute("data-resto-mode", "light");
    setMode("light");
  }, []);

  // With the owner on "system" and no stored override, keep following the OS.
  useEffect(() => {
    if (ownerMode !== "system") return;
    if (typeof window.matchMedia !== "function") return;
    if (localStorage.getItem(restoModeStorageKey(slug))) return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      const next: ResolvedRestoMode = event.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-resto-mode", next);
      setMode(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [ownerMode, slug]);

  if (mode === null) return null;

  const next: ResolvedRestoMode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      aria-pressed={mode === "dark"}
      onClick={() => {
        document.documentElement.setAttribute("data-resto-mode", next);
        try {
          localStorage.setItem(restoModeStorageKey(slug), next);
        } catch {
          // Private mode or storage disabled — the switch still applies to this
          // page view, it just won't be remembered.
        }
        setMode(next);
      }}
      className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55"
    >
      {mode === "dark" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, UtensilsCrossed } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const ANCHOR_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

/**
 * The whole point of this page: "restaurant login page can be found easily."
 * The Restaurant Login CTA is a fixed <Button> in every scroll state and in
 * the mobile sheet, not just an anchor link buried in a nav list.
 *
 * Layout follows Flodesk: brand left, links optically centred, actions right,
 * 80px tall and transparent over the hero, collapsing to 64px on a blurred
 * cream bar once the page moves. The CTA is ink rather than green — green is
 * the brand, but a filled green pill next to a green logo mark reads as two
 * competing marks instead of one destination.
 */
export function MarketingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled
          ? "border-border bg-background/80 backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-transparent"
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 transition-[height] duration-300 sm:px-10",
          scrolled ? "h-16" : "h-20"
        )}
      >
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 text-[1.0625rem] font-semibold tracking-tight text-ink"
        >
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-[width,height] duration-300",
              scrolled ? "size-7" : "size-8"
            )}
          >
            <UtensilsCrossed className={scrolled ? "size-3.5" : "size-4"} strokeWidth={2.5} />
          </span>
          Priinteve Menu
        </Link>

        <nav className="hidden items-center gap-8 text-[0.9375rem] text-muted-foreground md:flex">
          {ANCHOR_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative py-1 transition-colors hover:text-foreground"
            >
              {link.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-primary transition-transform duration-200 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-5 md:flex">
          <a
            href="#how-it-works"
            className="flex items-center gap-2 text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground"
          >
            {/* The dot is the word "live" doing its job — a menu that is
                actually up right now, not a screenshot of one. */}
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
            </span>
            See a live menu
          </a>
          <Button
            size="lg"
            className="h-11 bg-ink px-6 text-[0.9375rem] text-white hover:bg-ink hover:brightness-125"
            render={<Link href="/r/login" />}
          >
            Restaurant Login
          </Button>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Toggle navigation" className="md:hidden" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent className="flex-col gap-6 bg-background">
            <SheetTitle className="text-left text-base">Priinteve Menu</SheetTitle>
            <nav className="flex flex-col gap-1">
              {ANCHOR_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full px-3 py-2.5 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2.5">
              <Button variant="outline" size="lg" render={<a href="#how-it-works" />}>
                See a live menu
              </Button>
              <Button size="lg" className="bg-ink text-white hover:bg-ink" render={<Link href="/r/login" />}>
                Restaurant Login
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

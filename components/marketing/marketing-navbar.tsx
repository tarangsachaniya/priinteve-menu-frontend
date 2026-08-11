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
        "sticky top-0 z-50 border-b transition-colors duration-200",
        scrolled
          ? "border-border bg-background/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
            <UtensilsCrossed className="size-4" strokeWidth={2.5} />
          </span>
          Priinteve Menu
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          {ANCHOR_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" render={<a href="#how-it-works" />}>
            See a live menu
          </Button>
          <Button size="sm" render={<Link href="/r/login" />}>
            Restaurant Login
          </Button>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Toggle navigation" className="md:hidden" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent className="flex-col gap-6">
            <SheetTitle className="text-left text-base">Priinteve Menu</SheetTitle>
            <nav className="flex flex-col gap-1">
              {ANCHOR_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-auto flex flex-col gap-2">
              <Button variant="outline" render={<a href="#how-it-works" />}>
                See a live menu
              </Button>
              <Button render={<Link href="/r/login" />}>Restaurant Login</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

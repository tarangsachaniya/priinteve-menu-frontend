import Link from "next/link";
import { ArrowRight, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const CARDS_APP_URL = process.env.NEXT_PUBLIC_CARDS_APP_URL ?? "http://localhost:3000";

export function ClosingCta() {
  return (
    <section className="border-t border-border px-6 py-20 sm:px-8 sm:py-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl bg-ink px-8 py-14 text-center text-white">
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Ready to take your first QR order?
        </h2>
        <p className="max-w-md text-white/70">
          Log in to your restaurant console, or ask us to set your restaurant up.
        </p>
        <Button size="xl" variant="secondary" render={<Link href="/r/login" />} className="mt-1">
          Restaurant Login
          <ArrowRight />
        </Button>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="px-6 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-ink">
              <UtensilsCrossed className="size-3.5" strokeWidth={2.5} />
            </span>
            Priinteve Menu
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link href="/r/login" className="hover:text-foreground">Restaurant Login</Link>
            <Link href="/admin/login" className="hover:text-foreground">Admin</Link>
          </nav>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col items-start justify-between gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Priinteve. All rights reserved.</p>
          <a href={CARDS_APP_URL} className="hover:text-foreground">
            Also from Priinteve → Digital business cards
          </a>
        </div>
      </div>
    </footer>
  );
}

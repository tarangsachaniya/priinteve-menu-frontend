import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { HERO_STATS } from "@/lib/marketing/content";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(var(--primary)/0.22),transparent)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
              QR ordering for restaurants
            </span>

            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.05]">
              Table-side ordering, without the wait staff bottleneck
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              Guests scan a QR at their table, order straight from their phone, and pay however they like.
              Every order lands on your kitchen board the moment it&apos;s placed.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button size="xl" render={<Link href="/r/login" />}>
                Restaurant Login
                <ArrowRight />
              </Button>
              <Button size="xl" variant="outline" render={<a href="#how-it-works" />}>
                See how it works
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              {HERO_STATS.map(({ label, icon: Icon }) => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon className="size-4 text-primary" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative mx-auto w-full max-w-[300px]">
            <div className="overflow-hidden rounded-[2.5rem] border-8 border-ink bg-card shadow-[0_30px_60px_-20px_rgba(24,24,20,0.35)]">
              <div className="flex items-center justify-between bg-primary px-5 py-4 text-ink">
                <div>
                  <p className="text-xs font-medium opacity-70">Table 4</p>
                  <p className="text-base font-bold">Spice Garden</p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-full bg-white/40 text-xs font-bold">
                  ★ 4.6
                </span>
              </div>
              <div className="flex flex-col gap-3 p-4">
                {[
                  { name: "Paneer Tikka", price: "₹220", tag: "Bestseller" },
                  { name: "Butter Naan", price: "₹60", tag: null },
                  { name: "Dal Makhani", price: "₹180", tag: "Chef's pick" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      {item.tag && <p className="text-xs text-primary">{item.tag}</p>}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{item.price}</span>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-white">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <CheckCircle2 className="size-4" />
                    Place order
                  </span>
                  <span className="text-sm font-semibold tabular-nums">₹460</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

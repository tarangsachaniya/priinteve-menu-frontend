import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRICING_TIERS } from "@/lib/marketing/content";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal, RevealItem } from "@/components/ui/reveal";

/**
 * The highlighted tier inverts to ink rather than wearing a tinted background.
 * A tint says "this one is slightly different"; a solid dark card against two
 * light neighbours says "this is the one" from across the room, which is the
 * whole job of a highlighted tier.
 */
export function Pricing() {
  return (
    <section id="pricing" className="bg-card px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple pricing, no per-order cut"
          description="Start free, talk to us when you're running more than one branch."
        />

        <Reveal stagger className="mx-auto mt-16 grid max-w-4xl items-stretch gap-6 sm:grid-cols-2">
          {PRICING_TIERS.map((tier) => (
            <RevealItem
              key={tier.name}
              className={cn(
                "flex flex-col gap-6 rounded-[28px] p-8",
                tier.highlighted
                  ? "bg-ink text-white sm:-translate-y-2"
                  : "border border-border bg-background text-ink"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{tier.name}</h3>
                  <p className={cn("mt-1.5 text-sm", tier.highlighted ? "text-white/60" : "text-muted-foreground")}>
                    {tier.description}
                  </p>
                </div>
                {tier.highlighted && (
                  <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-[0.6875rem] font-semibold text-primary-foreground">
                    Multi-branch
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">{tier.price}</span>
                <span className={cn("text-sm", tier.highlighted ? "text-white/50" : "text-muted-foreground")}>
                  {tier.period}
                </span>
              </div>

              <ul className="flex flex-col gap-3">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.5} />
                    <span className={tier.highlighted ? "text-white/85" : undefined}>{feat}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className={cn(
                  "mt-auto h-12",
                  tier.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary hover:brightness-110"
                    : "bg-ink text-white hover:bg-ink hover:brightness-125"
                )}
                render={<Link href="/r/login" />}
              >
                {tier.highlighted ? "Talk to us" : "Get started"}
              </Button>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

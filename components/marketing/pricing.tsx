import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRICING_TIERS } from "@/lib/marketing/content";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal, RevealItem } from "@/components/ui/reveal";

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border px-6 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Pricing"
          title="Simple pricing, no per-order cut"
          description="Start free, talk to us when you're running more than one branch."
        />

        <Reveal stagger className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
          {PRICING_TIERS.map((tier) => (
            <RevealItem
              key={tier.name}
              className={cn(
                "flex flex-col gap-5 rounded-2xl border p-7",
                tier.highlighted ? "border-primary bg-primary/[0.06] shadow-lg" : "border-border/70 bg-card"
              )}
            >
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
              </div>

              <div>
                <span className="text-3xl font-bold tracking-tight">{tier.price}</span>
                <span className="ml-1.5 text-sm text-muted-foreground">{tier.period}</span>
              </div>

              <ul className="flex flex-col gap-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-auto"
                variant={tier.highlighted ? "default" : "outline"}
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

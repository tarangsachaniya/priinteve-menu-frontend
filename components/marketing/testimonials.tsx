import { Quote } from "lucide-react";

import { TESTIMONIALS } from "@/lib/marketing/content";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal, RevealItem } from "@/components/ui/reveal";

/**
 * Initial-in-a-circle avatars rather than stock headshots — no real
 * photography ships with this repo, and a fabricated "photo" of someone who
 * doesn't exist is worse than an honest placeholder.
 */
export function Testimonials() {
  return (
    <section className="bg-background px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeader eyebrow="Trusted by restaurants" title="Loved by restaurant owners" />

        <Reveal stagger className="mt-14 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <RevealItem
              key={t.name}
              className="flex flex-col gap-5 rounded-[28px] border border-border/70 bg-card p-7"
            >
              <Quote className="size-6 text-primary" strokeWidth={2.5} />
              <p className="flex-1 text-[0.9375rem] leading-relaxed text-ink">“{t.quote}”</p>
              <div className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback className="bg-primary/15 text-primary">
                    {t.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-ink">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.place}</p>
                </div>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

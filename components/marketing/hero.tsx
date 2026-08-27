import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { HERO_STATS } from "@/lib/marketing/content";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

/**
 * Centre-stacked, following the Flodesk reference: no product shot, no
 * gradient wash, nothing sharing the stage with the sentence.
 *
 * The device mock that used to sit on the right moved out entirely rather
 * than shrinking — a hero holding a phone AND a headline splits attention
 * between two focal points, and the phone screens now carry the Features
 * section where they have room to be read. The radial gradient went with it:
 * on cream it read as a smudge rather than as light.
 */
export function Hero() {
  return (
    <section className="px-6 pt-20 pb-24 sm:px-10 sm:pt-28 sm:pb-32">
      <Reveal>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 text-center">
          <span className="flex items-center gap-2.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            QR ordering for restaurants
          </span>

          {/* Three explicit lines rather than text-balance: the italic phrase
              has to land on a line of its own for the type contrast to read,
              and balancing would move it. */}
          <h1 className="text-[clamp(2.5rem,7vw,4.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-ink">
            <span className="block">Table-side ordering,</span>
            <span className="block font-serif text-[1.08em] font-normal tracking-[-0.01em] italic">
              without the wait
            </span>
            <span className="block">staff bottleneck</span>
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Guests tap a QR at their table, order straight from their phone, and pay however they like.
            Every order lands on your kitchen board the moment it&apos;s placed.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Button
              className="h-14 bg-primary px-8 text-white hover:bg-primary/90 shadow-lg"
              render={<Link href="/r/login" />}
            >
              <ArrowRight className="ml-2" />
            </Button>
            <Button
              size="xl"
              render={<a href="#kds-preview" />}
            >
              Kitchen Display
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 pt-6">
              <span key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="size-4 text-primary" strokeWidth={2.5} />
                {label}
            ))}
          </div>
        </div>
      </Reveal>
  );
}

import { FEATURES } from "@/lib/marketing/content";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal, RevealItem } from "@/components/ui/reveal";

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-border bg-muted/40 px-6 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="Everything included"
          title="Built for how a real kitchen runs"
          description="Not a generic ordering widget — every piece here is something a restaurant actually needed."
        />

        <Reveal stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <RevealItem
              key={title}
              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-6 transition-transform hover:-translate-y-1"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-ink">
                <Icon className="size-5" />
              </span>
              <h3 className="text-base font-semibold tracking-tight">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

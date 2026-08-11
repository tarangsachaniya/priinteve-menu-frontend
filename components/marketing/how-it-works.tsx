import { HOW_IT_WORKS } from "@/lib/marketing/content";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal, RevealItem } from "@/components/ui/reveal";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border px-6 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          eyebrow="How it works"
          title="Scan. Order. Pay. Done."
          description="No app to install, no waiting for someone to walk over — guests are ordering within seconds of sitting down."
        />

        <Reveal stagger className="mt-14 grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, title, description }) => (
            <RevealItem key={step} className="relative rounded-2xl border border-border/70 bg-card p-6">
              <span className="text-3xl font-bold tracking-tight text-primary/60">{step}</span>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

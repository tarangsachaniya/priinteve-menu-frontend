import { FAQS } from "@/lib/marketing/content";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal } from "@/components/ui/reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function Faq() {
  return (
    <section id="faq" className="border-t border-border bg-muted/40 px-6 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeader eyebrow="FAQ" title="Questions restaurant owners ask" />

        <Reveal className="mt-12 rounded-2xl border border-border/70 bg-card px-6">
          <Accordion>
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

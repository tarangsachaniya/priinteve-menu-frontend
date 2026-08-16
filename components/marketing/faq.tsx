import { FAQS } from "@/lib/marketing/content";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal } from "@/components/ui/reveal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

/**
 * Narrow measure and a plain divided list — the bordered card this used to sit
 * in boxed prose that was already the narrowest thing on the page, which read
 * as a second, smaller page rather than as answers.
 */
export function Faq() {
  return (
    <section id="faq" className="bg-background px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[720px]">
        <SectionHeader eyebrow="FAQ" title="Questions restaurant owners ask" />

        <Reveal className="mt-14">
          <Accordion className="border-t border-border">
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question} className="border-b border-border">
                <AccordionTrigger className="py-6 text-left text-lg font-medium tracking-tight text-ink">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 text-base leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

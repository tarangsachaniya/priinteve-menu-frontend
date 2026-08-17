import { Check, Plus, SmartphoneNfc } from "lucide-react";

import { HOW_IT_WORKS } from "@/lib/marketing/content";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { QrGlyph } from "@/components/marketing/phone-screens";

/**
 * Three steps, each with the thing it describes rather than a numeral in a
 * circle. The old cards were a digit, a heading and a paragraph — which asked
 * the reader to picture the scan, the order and the payment themselves. These
 * show all three.
 *
 * Deliberately static. Motion is the Features section's job, and a page where
 * every card is moving has no emphasis left to spend.
 */
const VISUALS = [ScanVisual, OrderVisual, PayVisual];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-card px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeader
          eyebrow="How it works"
          title="Scan. Order. Pay. Done."
          description="No app to install, no waiting for someone to walk over — guests are ordering within seconds of sitting down."
        />

        <Reveal stagger className="mt-16 grid gap-5 md:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, title, description }, i) => {
            const Visual = VISUALS[i];
            return (
              <RevealItem
                key={step}
                className="flex flex-col overflow-hidden rounded-[32px] bg-background"
              >
                <div className="flex h-[212px] items-center justify-center px-8 pt-10">
                  <Visual />
                </div>
                <div className="flex flex-col items-center gap-3 px-8 pt-8 pb-10 text-center">
                  <span className="text-[0.6875rem] font-semibold tracking-[0.16em] text-ink-muted uppercase tabular-nums">
                    Step {step}
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight text-balance text-ink">{title}</h3>
                  <p className="max-w-xs text-sm leading-relaxed text-muted-foreground text-pretty">
                    {description}
                  </p>
                </div>
              </RevealItem>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}

const PANEL = "rounded-2xl bg-card shadow-[0_18px_36px_-20px_rgb(23_21_18_/_0.28)]";

/** 01 — a printed table tent inside a camera's focus brackets, plus the NFC alternative. */
function ScanVisual() {
  return (
    <div className="relative flex size-full items-center justify-center" aria-hidden>
      <div className={`${PANEL} -rotate-3 px-5 py-4`}>
        <div className="text-ink">
          <QrGlyph />
        </div>
        <p className="mt-2 text-center text-[9px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
          Table 4
        </p>
      </div>

      {/* Focus brackets — the frame a phone camera draws, not decoration. */}
      {[
        "top-2 left-6 border-t-2 border-l-2 rounded-tl-md",
        "top-2 right-6 border-t-2 border-r-2 rounded-tr-md",
        "bottom-2 left-6 border-b-2 border-l-2 rounded-bl-md",
        "bottom-2 right-6 border-b-2 border-r-2 rounded-br-md",
      ].map((pos) => (
        <span key={pos} className={`pointer-events-none absolute size-6 border-primary/45 ${pos}`} />
      ))}

      {/* Understated alternative to scanning — echoes the "Table 4" caption's scale. */}
      <span className="absolute right-2 bottom-1 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 text-[8px] font-medium text-ink-muted shadow-sm">
        <SmartphoneNfc className="size-3" />
        or tap
      </span>
    </div>
  );
}

/** 02 — the guest's own basket filling up. */
function OrderVisual() {
  return (
    <div className={`${PANEL} w-full max-w-[228px] p-3`} aria-hidden>
      <div className="flex flex-col gap-1.5">
        {[
          ["Paneer Tikka", "₹220", true],
          ["Butter Naan", "₹60", true],
          ["Dal Makhani", "₹180", false],
        ].map(([name, price, added]) => (
          <div key={name as string} className="flex items-center gap-2 rounded-xl bg-background px-2.5 py-2">
            <span className="flex-1 truncate text-[11px] font-medium text-ink">{name}</span>
            <span className="text-[11px] font-semibold tabular-nums text-ink">{price}</span>
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                added ? "bg-primary text-primary-foreground" : "bg-border text-muted-foreground"
              }`}
            >
              {added ? <Check className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={3} />}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded-xl bg-ink px-3 py-2 text-white">
        <span className="text-[11px] font-medium">2 items in order</span>
        <span className="text-[11px] font-semibold tabular-nums">₹280</span>
      </div>
    </div>
  );
}

/** 03 — the guest's choice of method, then a settled bill. */
function PayVisual() {
  return (
    <div className="flex w-full max-w-[228px] flex-col gap-2.5" aria-hidden>
      <div className="flex gap-1.5">
        {["UPI", "Card", "Counter"].map((method, i) => (
          <span
            key={method}
            className={`flex-1 rounded-full py-1.5 text-center text-[10px] font-medium ${
              i === 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
            }`}
          >
            {method}
          </span>
        ))}
      </div>
      <div className={`${PANEL} flex flex-col gap-2 p-3`}>
        <div className="flex items-baseline justify-between text-[10.5px] text-muted-foreground">
          <span>Taxable value</span>
          <span className="tabular-nums">₹1,225</span>
        </div>
        <div className="flex items-baseline justify-between text-[10.5px] text-muted-foreground">
          <span>CGST + SGST</span>
          <span className="tabular-nums">₹61.26</span>
        </div>
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            Paid
          </span>
          <span className="text-sm font-semibold tabular-nums text-ink">₹1,286</span>
        </div>
      </div>
    </div>
  );
}

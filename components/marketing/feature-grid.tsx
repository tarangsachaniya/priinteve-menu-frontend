import { FEATURES } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import {
  KitchenBoardScreen,
  MenuControlScreen,
  QrTablesScreen,
} from "@/components/marketing/phone-screens";
import {
  InvoiceIllustration,
  PeakHourIllustration,
  ReviewsIllustration,
} from "@/components/marketing/feature-illustrations";

/**
 * Six features in two acts.
 *
 * Act one is the pitch moment, laid out as an asymmetric bento rather than
 * three equal columns: one tall card carrying the richest screen, two stacked
 * beside it. Each device is scaled past its card's edge and clipped, so the
 * screens read as objects the page is showing you rather than as images
 * pasted inside boxes.
 *
 * The three chosen are the ones a restaurant owner has to believe exist before
 * anything else matters — the menu is mine, the QR is per table, and orders
 * really do land on a screen in the kitchen.
 *
 * Act two is the three that are about accumulation rather than surface — an
 * invoice assembling, demand peaking, ratings arriving — so each gets a small
 * looping illustration instead of a screenshot.
 *
 * Copy stays sourced from lib/marketing/content.ts so there is one place to
 * edit a feature description, not two.
 */
const feature = (title: string) => {
  const found = FEATURES.find((f) => f.title === title);
  if (!found) throw new Error(`Unknown feature: ${title}`);
  return found;
};

const MOTION = [
  { ...feature("GST-ready invoices"), art: <InvoiceIllustration /> },
  { ...feature("Peak-hour smart menu"), art: <PeakHourIllustration /> },
  { ...feature("Guest reviews"), art: <ReviewsIllustration /> },
];

const CARD = "relative flex flex-col overflow-hidden rounded-[32px] bg-muted";

export function FeatureGrid() {
  return (
    <section id="features" className="bg-background px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1200px]">
        <SectionHeader
          eyebrow="Everything included"
          title="Built for how a real kitchen runs"
          description="Not a generic ordering widget — every piece here is something a restaurant actually needed."
        />

        <Reveal className="mt-16">
          {/* Rows size to their own content — no grid-rows-2. Forcing both to
              1fr made the shortest card carry 265px of dead space, and the
              tall card's device drove a height nothing else needed. Here the
              right column sets the height and the tall card matches it, with
              its device clipped by the card edge rather than sizing it. */}
          <div className="grid gap-5 lg:grid-cols-2">
            <article className={cn(CARD, "lg:row-span-2")}>
              <CardCopy {...feature("A menu you control")} className="px-8 pt-12 sm:px-12 sm:pt-14" />
              <div className="mt-10 flex min-h-0 flex-1 items-end justify-center px-8">
                {/* scale prop sets the layout box; the utility scale is visual
                    only, keeping the device inside a 390px card where 0.84
                    would render 337px wide against ~278px of usable width. */}
                <PhoneFrame scale={0.84} className="translate-y-14 -rotate-3 scale-[0.72] sm:scale-100">
                  <MenuControlScreen />
                </PhoneFrame>
              </div>
            </article>

            {/* Device first, cropped by the top edge — the reference's middle
                card, and what keeps the right column from mirroring itself. */}
            <article className={CARD}>
              <div className="flex h-[300px] justify-center overflow-hidden px-8">
                <PhoneFrame scale={0.6} className="-translate-y-28 rotate-2">
                  <QrTablesScreen />
                </PhoneFrame>
              </div>
              <CardCopy {...feature("A QR code per table")} className="px-8 pt-4 pb-12 sm:px-10" />
            </article>

            <article className={CARD}>
              <CardCopy {...feature("Live kitchen board")} className="px-8 pt-12 sm:px-10" />
              <div className="mt-8 flex h-[248px] justify-center overflow-hidden px-8">
                <PhoneFrame scale={0.6} className="-rotate-2">
                  <KitchenBoardScreen />
                </PhoneFrame>
              </div>
            </article>
          </div>
        </Reveal>

        <Reveal stagger className="mt-5 grid gap-5 sm:grid-cols-3">
          {MOTION.map(({ title, description, icon: Icon, art }) => (
            <RevealItem
              key={title}
              className="flex flex-col gap-5 rounded-[32px] bg-muted p-6 transition-transform duration-300 hover:-translate-y-1 sm:p-7"
            >
              {art}
              <div className="flex flex-col gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-mint text-mint-ink">
                  <Icon className="size-4" />
                </span>
                <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function CardCopy({
  title,
  description,
  className,
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <h3 className="text-2xl font-semibold tracking-tight text-balance text-ink">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
    </div>
  );
}

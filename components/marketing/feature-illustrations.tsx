import { Star } from "lucide-react";

/**
 * Small looping illustrations for the three features that have no phone
 * mockup. Each one animates the single verb in its title — an invoice that
 * assembles itself, demand that peaks, ratings that arrive — so the motion
 * carries meaning rather than decorating the card.
 *
 * All CSS: keyframes live in app/marketing-theme.css behind [data-marketing],
 * and every one is switched off under prefers-reduced-motion. No JS, no
 * observers, nothing that has to hydrate.
 */

const FRAME = "relative h-44 w-full overflow-hidden rounded-xl bg-background p-3.5";

/* ── GST-ready invoices ─────────────────────────────────────────────────── */

const LINES = [
  ["Paneer Tikka × 2", "₹640"],
  ["Butter Naan × 1", "₹70"],
  ["Jeera Rice × 1", "₹215"],
];

export function InvoiceIllustration() {
  return (
    <div className={FRAME} aria-hidden>
      <div className="flex h-full flex-col rounded-lg bg-card p-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[9px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Tax invoice</span>
          <span className="font-mono text-[8.5px] text-ink-muted">RK/26-27/0214</span>
        </div>

        {/* Line items landing one after another, the way they do as a table
            orders through the evening. */}
        <div className="mt-2 flex flex-col gap-1">
          {LINES.map(([item, amt], i) => (
            <div
              key={item}
              className="mk-line flex items-baseline justify-between text-[9.5px]"
              style={{ animationDelay: `${i * 0.28}s` }}
            >
              <span className="truncate text-muted-foreground">{item}</span>
              <span className="shrink-0 font-medium tabular-nums text-ink">{amt}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 h-px bg-border" />

        <div className="mt-1.5 flex flex-col gap-0.5">
          {[
            ["CGST 2.5%", "₹30.63"],
            ["SGST 2.5%", "₹30.63"],
          ].map(([label, amt], i) => (
            <div
              key={label}
              className="mk-line flex items-baseline justify-between text-[8.5px] text-muted-foreground"
              style={{ animationDelay: `${0.84 + i * 0.2}s` }}
            >
              <span>{label}</span>
              <span className="tabular-nums">{amt}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between">
          <span className="mk-stamp rounded-full bg-mint px-2 py-0.5 text-[8.5px] font-semibold text-mint-ink">
            GSTR-1 filed ✓
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-ink">₹1,286</span>
        </div>
      </div>
    </div>
  );
}

/* ── Peak-hour smart menu ───────────────────────────────────────────────── */

// Low/high pairs per bar. The rush sits in the middle, which is what the
// band and the label point at.
const BARS: [number, number][] = [
  [0.22, 0.3], [0.3, 0.42], [0.38, 0.55], [0.55, 0.86], [0.7, 1],
  [0.62, 0.95], [0.44, 0.6], [0.3, 0.4], [0.24, 0.32],
];

export function PeakHourIllustration() {
  return (
    <div className={FRAME} aria-hidden>
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] font-semibold tracking-[0.08em] text-ink-muted uppercase">Demand</span>
        <span className="rounded-full bg-mint px-2 py-0.5 text-[9px] font-medium text-mint-ink">7–9 PM rush</span>
      </div>

      <div className="relative mt-3 h-[68px]">
        <div className="flex h-full items-end gap-1.5">
          {BARS.map(([low, high], i) => (
            <div
              key={i}
              className="mk-bar flex-1 rounded-t-sm bg-primary/80"
              style={
                {
                  height: "100%",
                  "--bar-low": low,
                  "--bar-high": high,
                  animationDelay: `${i * 0.12}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        {/* The rush window sits ON the tall bars rather than sweeping past
            them — a band travelling over the quiet hours would contradict the
            data underneath it and the label naming 7–9 PM. */}
        <div className="pointer-events-none absolute inset-y-0 left-[31%] w-[36%] rounded-md bg-clay/10 ring-1 ring-clay/20" />
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        <span className="rounded-full bg-card px-2 py-0.5 text-[9px] text-muted-foreground line-through">
          Slow-cook Biryani
        </span>
        <span className="rounded-full bg-ink px-2 py-0.5 text-[9px] font-medium text-white">Demoted</span>
      </div>
    </div>
  );
}

/* ── Guest reviews ──────────────────────────────────────────────────────── */

const REVIEWS = [
  { name: "Priya", text: "Food was hot and fast.", stars: 5 },
  { name: "Arjun", text: "Loved the paneer tikka.", stars: 4 },
];

export function ReviewsIllustration() {
  return (
    <div className={FRAME} aria-hidden>
      <div className="flex items-center gap-2.5">
        <span className="text-2xl leading-none font-semibold tabular-nums text-ink">4.6</span>
        <div className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              className="mk-star size-3.5 fill-primary text-primary"
              style={{ animationDelay: `${i * 0.14}s` }}
            />
          ))}
        </div>
        <span className="ml-auto text-[9px] text-ink-muted">312 reviews</span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {REVIEWS.map((r, i) => (
          <div
            key={r.name}
            className="mk-review rounded-lg bg-card p-2"
            style={{ animationDelay: `${i * 0.5}s` }}
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-medium text-ink">{r.name}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: r.stars }).map((_, s) => (
                  <Star key={s} className="size-2.5 fill-primary text-primary" />
                ))}
              </div>
              <span
                className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-medium ${
                  i === 0 ? "bg-mint text-mint-ink" : "bg-background text-muted-foreground"
                }`}
              >
                {i === 0 ? "Published" : "Private"}
              </span>
            </div>
            <div className="mt-1 truncate text-[9.5px] text-muted-foreground">{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

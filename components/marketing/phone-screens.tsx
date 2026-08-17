import { PhotoSlot } from "@/components/marketing/phone-frame";

/**
 * Static ports of three screens from "Mobile application UI mockups/":
 * ScreenMenuControl, ScreenQRTables and ScreenInvoices.
 *
 * Presentational only — no state, no toggles, no fetch. The originals are
 * interactive Claude Design prototypes; here they are the frozen "best frame"
 * of each, because on a landing page they are read, not operated.
 *
 * Type is DM Sans rather than the mockups' Poppins on purpose: the screens sit
 * inside the marketing page, and a second grotesk two paragraphs from the
 * first reads as a mistake rather than as a different product.
 */

const SCREEN = "flex h-full flex-col overflow-hidden bg-card pt-[60px] pb-[30px] text-ink";

function ScreenHeader({
  title,
  meta,
  chip,
  chipTone = "mint",
}: {
  title: string;
  meta: string;
  chip: string;
  chipTone?: "mint" | "plain";
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-1.5">
      <div className="flex flex-col gap-[3px]">
        <div className="text-[23px] font-semibold tracking-[-0.3px]">{title}</div>
        <div className="text-[12.5px] whitespace-nowrap text-muted-foreground">{meta}</div>
      </div>
      {chipTone === "mint" ? (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-mint px-3 py-[7px] text-[11.5px] font-medium text-mint-ink">
          <span className="size-1.5 rounded-full bg-primary" />
          {chip}
        </div>
      ) : (
        <div className="shrink-0 rounded-[10px] bg-background px-3 py-2 text-[11.5px] font-medium">{chip}</div>
      )}
    </div>
  );
}

/* ── Mockup 6 — A menu you control ──────────────────────────────────────── */

const DISHES = [
  { name: "Paneer Tikka", price: "₹320", diet: "Veg", stock: true },
  { name: "Tandoori Platter", price: "₹480", diet: "Non-veg", stock: true },
  { name: "Hara Bhara Kebab", price: "₹260", diet: "Veg", stock: false },
  { name: "Chilli Cheese Toast", price: "₹190", diet: "Veg", stock: true },
];

export function MenuControlScreen() {
  return (
    <div className={SCREEN}>
      <ScreenHeader title="Menu" meta="64 dishes · 7 categories" chip="Live now" />

      <div className="flex gap-2 overflow-hidden px-5 pt-4">
        {["Starters", "Mains", "Breads", "Sweets"].map((c, i) => (
          <div
            key={c}
            className={`rounded-full px-[13px] py-[7px] text-xs font-medium whitespace-nowrap ${
              i === 0 ? "bg-ink text-white" : "bg-background text-muted-foreground"
            }`}
          >
            {c}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[9px] px-5 pt-4">
        {DISHES.map((d) => (
          <div
            key={d.name}
            className={`flex items-center gap-3 rounded-2xl bg-background p-3 ${d.stock ? "" : "opacity-55"}`}
          >
            <PhotoSlot className="size-[84px] shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <div className="text-sm font-medium">{d.name}</div>
              <div className="flex items-center gap-2">
                <div className="text-[13px] font-semibold tabular-nums">{d.price}</div>
                <div
                  className={`rounded border px-[5px] py-px text-[10px] ${
                    d.diet === "Veg" ? "border-primary/35 text-primary" : "border-clay/35 text-clay"
                  }`}
                >
                  {d.diet}
                </div>
                <div className="text-[10.5px] whitespace-nowrap text-ink-muted">
                  {d.stock ? "In stock" : "Out of stock"}
                </div>
              </div>
            </div>
            <div
              className={`flex h-6 w-[42px] shrink-0 rounded-full p-[3px] ${d.stock ? "bg-primary" : "bg-border"}`}
            >
              <div className={`size-[18px] rounded-full bg-white ${d.stock ? "translate-x-[18px]" : ""}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2.5 px-5">
        <div className="rounded-2xl border border-dashed border-ink/15 p-[13px] text-center text-[12.5px] text-muted-foreground">
          + Add a dish or category
        </div>
        <div className="flex items-center gap-2.5 rounded-2xl bg-ink px-[15px] py-[13px] text-white">
          <span className="size-[7px] rounded-full bg-primary" />
          <span className="text-[12.5px] font-medium">All changes live</span>
          <span className="ml-auto text-[11.5px] text-white/50">Guests see it now</span>
        </div>
      </div>
    </div>
  );
}

/* ── Mockup 1 — A QR code per table ─────────────────────────────────────── */

const TABLES = [
  { id: "T1", note: "4 seats", tone: "idle" },
  { id: "T2", note: "Ordering", tone: "busy" },
  { id: "T3", note: "2 seats", tone: "idle" },
  { id: "T4", note: "Ordering", tone: "busy" },
  { id: "T5", note: "6 seats", tone: "idle" },
  { id: "T6", note: "Paid", tone: "paid" },
] as const;

const TABLE_TONE = {
  idle: { text: "text-muted-foreground", bar: "bg-border" },
  busy: { text: "text-clay", bar: "bg-clay" },
  paid: { text: "text-primary", bar: "bg-primary" },
};

export function QrGlyph() {
  // Hand-placed modules rather than a generated code: it must read as a QR at
  // 66px without encoding a URL that would then be wrong.
  const cells = [
    [8, 1, 1, 2], [10, 1, 1, 1], [12, 2, 1, 1], [8, 4, 2, 1], [11, 4, 1, 1],
    [1, 8, 2, 1], [4, 8, 1, 1], [2, 10, 1, 1], [1, 12, 1, 1], [4, 11, 1, 2],
    [8, 8, 2, 2], [11, 8, 1, 1], [13, 9, 1, 1], [8, 11, 1, 1], [10, 12, 2, 1],
    [12, 10, 1, 1], [15, 8, 1, 1], [17, 8, 2, 1], [16, 10, 1, 1], [18, 11, 1, 2],
    [15, 13, 1, 1], [8, 15, 1, 2], [10, 15, 2, 1], [12, 17, 1, 1], [9, 18, 1, 1],
    [14, 16, 2, 2], [17, 15, 1, 1], [18, 18, 2, 1], [16, 19, 1, 1],
  ];
  return (
    <svg width="66" height="66" viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden>
      <rect width="21" height="21" fill="#fff" />
      <g fill="currentColor">
        {[[1, 1], [15, 1], [1, 15]].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="5" height="5" />
            <rect x={x + 1} y={y + 1} width="3" height="3" fill="#fff" />
            <rect x={x + 2} y={y + 2} width="1" height="1" />
          </g>
        ))}
        {cells.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} />
        ))}
      </g>
    </svg>
  );
}

export function QrTablesScreen() {
  return (
    <div className={SCREEN}>
      <ScreenHeader title="Tables & QR" meta="Ruchi Kitchen · 12 tables" chip="5 active" />

      <div className="mx-5 mt-4 flex flex-col gap-3.5 rounded-[18px] bg-background p-4">
        <div className="flex items-center gap-3.5">
          <div className="flex size-[92px] shrink-0 items-center justify-center rounded-xl bg-card text-ink">
            <QrGlyph />
          </div>
          <div className="flex min-w-0 flex-col gap-[5px]">
            <div className="text-base font-semibold">Table T4 code</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">ruchi.menu/t/t4</div>
            <div className="text-[11px] font-medium text-primary">Opens straight into this table&apos;s order</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <div className="flex-1 rounded-xl bg-ink py-[13px] text-center text-[13.5px] font-medium text-white">
            Print code
          </div>
          <div className="flex-1 rounded-xl bg-card py-[13px] text-center text-[13.5px] font-medium">
            Print all 12
          </div>
        </div>
      </div>

      <div className="flex gap-2 px-5 pt-4">
        <div className="rounded-full bg-ink px-3.5 py-[7px] text-xs font-medium text-white">Ground floor</div>
        <div className="rounded-full bg-background px-3.5 py-[7px] text-xs font-medium text-muted-foreground">
          Terrace
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-5 pt-4">
        {TABLES.map((t) => (
          <div key={t.id} className="flex flex-col gap-[9px] rounded-2xl bg-background p-3 pb-[11px]">
            <div className="text-[15px] font-semibold">{t.id}</div>
            <div className={`text-[10.5px] ${TABLE_TONE[t.tone].text}`}>{t.note}</div>
            <div className={`h-[3px] rounded-full ${TABLE_TONE[t.tone].bar}`} />
          </div>
        ))}
      </div>

      <div className="mt-auto px-5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-ink px-[15px] py-[13px] text-white">
          <span className="size-[7px] rounded-full bg-primary" />
          <span className="text-[12.5px] font-medium">2 tables ordering now</span>
          <span className="ml-auto text-[11.5px] text-white/50">Live</span>
        </div>
      </div>
    </div>
  );
}

/* ── Mockup 2 — Live kitchen board ──────────────────────────────────────── */

// The only dark screen of the three. That is the mockup's own choice and worth
// keeping: this is the one surface that lives on a wall in a hot kitchen, and
// it should not look like the other two.
const STAGES = {
  placed: { name: "Placed", chip: "bg-white/[0.09] text-white/75", next: "Start preparing →", fg: "text-white/75" },
  preparing: { name: "Preparing", chip: "bg-[#E4A33B]/20 text-[#F0BE72]", next: "Mark ready →", fg: "text-[#F0BE72]" },
  ready: { name: "Ready", chip: "bg-[#5FC48C]/20 text-[#5FC48C]", next: "Hand over →", fg: "text-[#5FC48C]" },
} as const;

const ORDERS = [
  { id: "#1428", table: "Table 4", items: "2 × Paneer Tikka · 1 × Butter Naan · 1 × Jeera Rice", age: "1 min", count: 4, stage: "placed" },
  { id: "#1427", table: "Table 9", items: "1 × Masala Dosa · 2 × Filter Coffee", age: "4 min", count: 3, stage: "preparing" },
  { id: "#1426", table: "Terrace 2", items: "1 × Veg Thali · 1 × Buttermilk", age: "7 min", count: 2, stage: "preparing" },
  { id: "#1425", table: "Table 2", items: "3 × Idli Sambar · 1 × Vada", age: "11 min", count: 4, stage: "ready" },
] as const;

export function KitchenBoardScreen() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-ink pt-[60px] pb-[30px] text-white">
      <div className="flex items-start justify-between gap-3 px-5 pt-1.5">
        <div className="flex flex-col gap-[3px]">
          <div className="text-[23px] font-semibold tracking-[-0.3px]">Kitchen board</div>
          <div className="text-[12.5px] text-white/55">Tap a ticket to move it forward</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#5FC48C]/[0.16] px-[11px] py-[7px] text-[11.5px] font-medium text-[#5FC48C]">
          <span className="size-1.5 rounded-full bg-primary" />
          Live
        </div>
      </div>

      <div className="flex gap-2 px-5 pt-4">
        {[
          ["1", "Placed", "bg-white/[0.06]", "text-white", "text-white/50"],
          ["2", "Preparing", "bg-[#E4A33B]/[0.14]", "text-[#F0BE72]", "text-[#F0BE72]/70"],
          ["1", "Ready", "bg-[#5FC48C]/[0.14]", "text-[#5FC48C]", "text-[#5FC48C]/75"],
        ].map(([n, label, bg, fg, sub]) => (
          <div key={label} className={`flex flex-1 flex-col gap-[3px] rounded-xl px-3 py-2.5 ${bg}`}>
            <div className={`text-[19px] font-semibold tabular-nums ${fg}`}>{n}</div>
            <div className={`text-[10.5px] ${sub}`}>{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-4">
        {ORDERS.map((o) => {
          const s = STAGES[o.stage];
          return (
            <div key={o.id} className="flex flex-col gap-2.5 rounded-2xl bg-[#211E1A] px-3.5 py-[13px]">
              <div className="flex items-center justify-between gap-2.5">
                <div className="flex shrink-0 items-baseline gap-2">
                  <div className="text-[15px] font-semibold whitespace-nowrap">{o.table}</div>
                  <div className="font-mono text-[11px] whitespace-nowrap text-white/40">{o.id}</div>
                </div>
                <div className={`rounded-full px-2.5 py-[5px] text-[11.5px] font-medium ${s.chip}`}>{s.name}</div>
              </div>
              <div className="text-[12.5px] leading-[1.5] text-white/[0.62]">{o.items}</div>
              <div className="flex items-center justify-between">
                <div className="text-[11px] whitespace-nowrap text-white/[0.38]">
                  {o.age} ago · {o.count} items
                </div>
                <div className={`text-[11.5px] font-medium ${s.fg}`}>{s.next}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Mockup 3 — GST-ready invoices ──────────────────────────────────────── */

const INVOICES = [
  { no: "RK/26-27/0214", meta: "Table 4 · 8:42 PM · UPI", amt: "₹1,286" },
  { no: "RK/26-27/0213", meta: "Terrace 2 · 8:20 PM · Card", amt: "₹742" },
  { no: "RK/26-27/0212", meta: "Table 9 · 7:58 PM · Cash", amt: "₹398" },
  { no: "RK/26-27/0211", meta: "Table 1 · 7:31 PM · UPI", amt: "₹1,054" },
];

export function InvoicesScreen() {
  return (
    <div className={SCREEN}>
      <ScreenHeader title="Invoices" meta="August 2026 · 214 invoices" chip="Export" chipTone="plain" />

      <div className="mx-5 mt-4 flex flex-col gap-[11px] rounded-2xl bg-background px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <div className="text-[11.5px] text-muted-foreground">Taxable value</div>
          <div className="text-base font-semibold tabular-nums">₹4,18,600</div>
        </div>
        <div className="h-px bg-ink/[0.07]" />
        <div className="flex gap-2.5">
          {[
            ["CGST 2.5%", "₹10,465", ""],
            ["SGST 2.5%", "₹10,465", ""],
            ["Filed", "GSTR-1 ✓", "text-primary"],
          ].map(([label, value, tone]) => (
            <div key={label} className="flex flex-1 flex-col gap-0.5">
              <div className="text-[10.5px] text-muted-foreground">{label}</div>
              <div className={`text-[13.5px] font-medium tabular-nums ${tone}`}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pt-[18px] pb-2 text-[11px] font-semibold tracking-[0.7px] text-ink-muted">TODAY</div>

      <div className="flex flex-col gap-2 px-5">
        {INVOICES.map((inv) => (
          <div
            key={inv.no}
            className="flex items-center justify-between gap-2.5 rounded-2xl bg-background px-3.5 py-[13px]"
          >
            <div className="flex flex-col gap-[3px]">
              <div className="text-[13.5px] font-medium">{inv.no}</div>
              <div className="text-[11px] text-muted-foreground">{inv.meta}</div>
            </div>
            <div className="flex flex-col items-end gap-[3px]">
              <div className="text-[14.5px] font-semibold tabular-nums">{inv.amt}</div>
              <div className="rounded-full bg-mint px-[7px] py-0.5 text-[10px] text-mint-ink">Tax invoice</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex gap-2.5 px-5">
        <div className="flex-1 rounded-xl bg-ink py-[13px] text-center text-[13.5px] font-medium text-white">
          Share PDF
        </div>
        <div className="flex-1 rounded-xl bg-background py-[13px] text-center text-[13.5px] font-medium">Print</div>
      </div>
    </div>
  );
}

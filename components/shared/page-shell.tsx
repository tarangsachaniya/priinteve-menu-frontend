import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";

/**
 * The one `<main>` every console and admin page renders into.
 *
 * ─── What this replaces ──────────────────────────────────────────────────────
 *
 * Nine pages each hand-wrote `<main className="mx-auto max-w-{X} p-6 sm:p-8
 * lg:p-10">` and then rendered PageHeader inside it — and PageHeader's sticky
 * bar bleeds to the page edge with a hardcoded `-mx-6 sm:-mx-8`, which is only
 * correct because every one of those nine copies happened to agree on
 * `p-6 sm:p-8`. Nothing enforced that agreement; a page that padded itself
 * differently would silently misalign the header with no error anywhere.
 *
 * Collapsing the pair into one component is what actually fixes it: this file
 * is now the ONLY caller of PageHeader (see that component's own note), so the
 * padding and the bleed that has to match it are declared next to each other
 * once, not trusted to stay in sync across nine files that never look at each
 * other.
 *
 * ─── Width, chosen deliberately rather than left to whoever writes the next page ───
 *
 *   reading  a form or a short read — settings sections, reviews.
 *   grid     card grids — dashboard, menu, tables.
 *   wide     dense tables and boards — orders, history.
 *   nav      reading width plus room for a side rail — currently only the
 *            settings section nav; add here if a second page needs the shape
 *            rather than picking an ad hoc value at the call site.
 */
const WIDTH = {
  reading: "max-w-3xl",
  grid: "max-w-6xl",
  wide: "max-w-7xl",
  nav: "max-w-5xl",
} as const;

export function PageShell({
  width = "grid",
  icon,
  title,
  description,
  action,
  children,
}: {
  width?: keyof typeof WIDTH;
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className={cn("mx-auto p-6 sm:p-8 lg:p-10", WIDTH[width])}>
      <PageHeader icon={icon} title={title} description={description} action={action} />
      {children}
    </main>
  );
}

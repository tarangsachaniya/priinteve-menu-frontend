import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * "Nothing here yet" for a whole page or panel — the menu with no
 * categories, the board with no live orders, the tables list before the
 * first one is added.
 *
 * Four call sites had converged on this exact shape by hand (dashed card,
 * a circled icon, a title, a muted line beneath it) before this existed,
 * which is the surest sign it belonged in one place — a fifth copy typed
 * slightly differently is how "py-14" and "py-16" end up meaning the same
 * thing in two places that now look subtly unaligned next to each other.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed border-border", className)}>
      <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-ink">
          <Icon className="size-6" />
        </span>
        <div>
          <p className="font-medium">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

/**
 * "Nothing here" for one lane inside something bigger — a kitchen lane with
 * no tickets, an orders-board column, a menu category with no dishes yet.
 *
 * Deliberately not EmptyState at a smaller size: a Card-in-a-card reads as
 * two panels stacked rather than one lane sitting empty, and a whole icon
 * circle is more ceremony than "nothing to cook right now" needs.
 */
export function EmptyLane({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-2xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

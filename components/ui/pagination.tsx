import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/**
 * Which page numbers to render, collapsing the middle once there are enough
 * pages to need it. Exported because the customer menu needs the same
 * sequence with entirely different chrome — see components/order/menu-pager.tsx.
 */
export function getPageList(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)

  const result: (number | "ellipsis")[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) {
      result.push("ellipsis")
    }
    result.push(p)
  })

  return result
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const pages = getPageList(page, totalPages)

  return (
    <nav
      data-slot="pagination"
      aria-label="Pagination"
      className={cn("flex items-center gap-1", className)}
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeftIcon />
      </Button>

      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span
            key={`ellipsis-${i}`}
            className="flex size-7 items-center justify-center text-muted-foreground"
          >
            <MoreHorizontalIcon className="size-4" />
          </span>
        ) : (
          <Button
            key={p}
            type="button"
            variant={p === page ? "default" : "outline"}
            size="icon-sm"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Button>
        )
      )}

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        <ChevronRightIcon />
      </Button>
    </nav>
  )
}

export { Pagination }

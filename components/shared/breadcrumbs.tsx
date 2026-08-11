"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { labelForSegmentPath } from "@/lib/nav-config";

function titleCase(segment: string) {
  return segment
    .replace(/-/g, " ")
    .replace(/\[(.+)\]/, "$1")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Breadcrumbs({ rootLabel = "Dashboard" }: { rootLabel?: string }) {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = labelForSegmentPath(href) ?? titleCase(segment);
    return { href, label };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href={segments[0] === "admin" ? "/admin" : "/dashboard"} className="hover:text-foreground">
        {rootLabel}
      </Link>
      {crumbs.slice(1).map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 shrink-0" />
          {i === crumbs.length - 2 ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

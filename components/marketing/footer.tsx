import Link from "next/link";
import { ArrowRight, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const CARDS_APP_URL = process.env.NEXT_PUBLIC_CARDS_APP_URL ?? "http://localhost:3000";

/**
 * The crescendo. Green is rationed everywhere above — a dot, a chip, an icon
 * — so that it can take a full-bleed band exactly once, at the point where the
 * only thing left to do is log in.
 */
export function ClosingCta() {
  return (
    <section className="bg-primary px-6 py-24 sm:px-10 sm:py-28">
      <div className="mx-auto flex max-w-[720px] flex-col items-center gap-6 text-center">
        <h2 className="text-4xl font-semibold tracking-[-0.02em] text-balance text-primary-foreground sm:text-5xl">
          Ready to take your first QR order?
        </h2>
        <p className="max-w-md font-serif text-xl text-primary-foreground/75 italic">
          Log in to your restaurant console, or ask us to set your restaurant up.
        </p>
        <Button
          size="xl"
          className="mt-2 h-14 bg-ink px-8 text-white hover:bg-ink hover:brightness-125"
          render={<Link href="/r/login" />}
        >
          Restaurant Login
          <ArrowRight />
        </Button>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-ink px-6 py-16 text-white sm:px-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col items-start justify-between gap-10 sm:flex-row sm:items-start">
          <div className="flex max-w-xs flex-col gap-3">
            <Link href="/" className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <UtensilsCrossed className="size-3.5" strokeWidth={2.5} />
              </span>
              Priinteve Menu
            </Link>
            <p className="text-sm leading-relaxed text-white/55">
              Table-side QR ordering, a live kitchen board, and GST-ready invoices.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-14 gap-y-8 sm:grid-cols-3">
            <FooterColumn
              heading="Product"
              links={[
                { href: "#how-it-works", label: "How it works" },
                { href: "#features", label: "Features" },
                { href: "#pricing", label: "Pricing" },
                { href: "#faq", label: "FAQ" },
              ]}
            />
            <FooterColumn
              heading="Access"
              links={[
                { href: "/r/login", label: "Restaurant Login" },
                { href: "/admin/login", label: "Admin" },
              ]}
            />
            <FooterColumn
              heading="Company"
              links={[{ href: CARDS_APP_URL, label: "Digital business cards" }]}
            />
          </div>
        </div>

        <Separator className="my-10 bg-white/10" />

        <p className="text-xs text-white/45">© {new Date().getFullYear()} Priinteve. All rights reserved.</p>
      </div>
    </footer>
  );
}

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-white/40 uppercase">{heading}</p>
      <nav className="flex flex-col gap-2.5">
        {links.map((link) => (
          <Link key={link.label} href={link.href} className="text-sm text-white/70 transition-colors hover:text-white">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { LogOut, Menu, UtensilsCrossed } from "lucide-react";

import Link from "next/link";

import { RESTAURANT_NAV_ITEMS, SETTINGS_NAV_ITEMS } from "@/lib/restaurant/nav-config";
import { NavItemLink } from "@/components/dashboard/nav-item";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Settings' seven sections, indented under the Settings link itself rather
 * than a tab bar in the content area — see SETTINGS_NAV_ITEMS' own comment
 * for why. Rendered only while a settings page is actually open, so every
 * other section of the sidebar stays exactly as short as it always was.
 *
 * Plain conditional styling rather than NavItemLink's shared-layout pill —
 * that pill uses `layoutId="nav-active-pill"`, and a second list of items
 * reusing it here would put eight elements in one framer-motion group,
 * animating the top-level Settings pill and a sub-item's pill as if they
 * were the same element sliding between two very different positions.
 */
function SettingsSubNav({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <div className="ml-4 flex flex-col gap-0.5 border-l border-border pl-3.5">
      {SETTINGS_NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              isActive ? "font-medium text-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      {RESTAURANT_NAV_ITEMS.map((item) => {
        const isActive = Boolean(pathname === item.href || pathname?.startsWith(`${item.href}/`));
        return (
          <div key={item.href} className="flex flex-col gap-1">
            <NavItemLink
              href={item.href}
              label={item.label}
              icon={item.icon}
              isActive={isActive}
              onNavigate={onNavigate}
            />
            {item.href === "/r/settings" && isActive && (
              <SettingsSubNav pathname={pathname} onNavigate={onNavigate} />
            )}
          </div>
        );
      })}
    </>
  );
}

function ProfileFooter({ email }: { email: string }) {
  const router = useRouter();
  const initial = email.charAt(0).toUpperCase() || "R";

  async function signOut() {
    await fetch("/api/restaurant/auth/logout", { method: "POST" });
    router.push("/r/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <div className="flex items-center gap-2.5 px-3 py-1.5">
        <Avatar size="sm">
          <AvatarFallback className="bg-primary/15 text-ink">{initial}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-medium text-foreground">{email}</span>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="flex items-center gap-2.5 rounded-full px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="size-4 shrink-0" />
        Sign out
      </button>
    </div>
  );
}

function Logo({ name }: { name: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
        <UtensilsCrossed className="size-4" strokeWidth={2.5} />
      </span>
      <span className="truncate text-lg font-bold tracking-tight">{name}</span>
    </div>
  );
}

export function RestaurantSidebar({
  restaurantName,
  email,
}: {
  restaurantName: string;
  email: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-border bg-card p-4 md:flex">
        <Logo name={restaurantName} />
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <ProfileFooter email={email} />
      </nav>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 p-3 backdrop-blur-md md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-ink">
            <UtensilsCrossed className="size-3.5" strokeWidth={2.5} />
          </span>
          <span className="truncate text-base font-bold tracking-tight">{restaurantName}</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Toggle navigation" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent className="left-0 right-auto flex-col slide-in-from-left data-[closed]:slide-out-to-left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
            <ProfileFooter email={email} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

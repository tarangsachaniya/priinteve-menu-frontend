"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, UtensilsCrossed } from "lucide-react";

import { NavItemLink } from "@/components/dashboard/nav-item";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Platform-admin shell for the restaurant-provisioning pages only — this app
 * doesn't carry plans/users/content, those stay in Cards' own admin. Signs
 * out via /api/auth/logout (pv_session, aud "user"), same realm as Cards.
 */
const ADMIN_NAV_ITEMS = [{ href: "/admin/restaurants", label: "Restaurants", icon: UtensilsCrossed }];

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      {ADMIN_NAV_ITEMS.map((item) => (
        <NavItemLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          isActive={Boolean(pathname === item.href || pathname?.startsWith(`${item.href}/`))}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

function ProfileFooter({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const initial = userEmail.charAt(0).toUpperCase() || "A";

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <div className="flex items-center gap-2.5 px-3 py-1.5">
        <Avatar size="sm">
          <AvatarFallback className="bg-primary/15 text-ink">{initial}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm font-medium text-foreground">{userEmail}</span>
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

function Logo() {
  return (
    <Link href="/admin/restaurants" className="mb-2 flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-ink">
        <UtensilsCrossed className="size-4" strokeWidth={2.5} />
      </span>
      Priinteve Admin
    </Link>
  );
}

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 border-r border-border bg-card p-4 md:flex">
        <Logo />
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <ProfileFooter userEmail={userEmail} />
      </nav>

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 p-3 backdrop-blur-md md:hidden">
        <Link href="/admin/restaurants" className="flex items-center gap-2 text-base font-bold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-ink">
            <UtensilsCrossed className="size-3.5" strokeWidth={2.5} />
          </span>
          Priinteve Admin
        </Link>
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
            <ProfileFooter userEmail={userEmail} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

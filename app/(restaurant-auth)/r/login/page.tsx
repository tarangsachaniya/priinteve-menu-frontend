"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { IconInput } from "@/components/auth/icon-input";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { restaurantLoginSchema } from "@/lib/validations/restaurant";

export default function RestaurantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = restaurantLoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error("Enter a valid email and password");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/restaurant/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Invalid email or password");
        return;
      }

      router.push("/r/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink px-14 py-16 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/4 -z-10 h-[36rem] bg-[radial-gradient(ellipse_60%_60%_at_50%_30%,rgba(198,241,53,0.16),transparent_70%)]"
        />

        <div className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-ink">
            <UtensilsCrossed className="size-4" strokeWidth={2.5} />
          </span>
          Restaurant Console
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-bold text-balance text-white">
            Your menu, tables, and orders — in one place.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {[
              "Publish your menu and toggle items in and out of stock instantly.",
              "Give every table its own QR code that opens your live menu.",
              "Watch orders arrive and move them through the kitchen in real time.",
            ].map((line) => (
              <li key={line} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-ink-muted">Powered by Priinteve Innovations</p>
      </div>

      <div className="flex flex-col items-center justify-center bg-background px-6 py-16">
        <div className="mb-8 flex items-center gap-2 text-lg font-bold tracking-tight lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-ink">
            <UtensilsCrossed className="size-4" strokeWidth={2.5} />
          </span>
          Restaurant Console
        </div>

        <Card className="w-full max-w-sm border-border/80 shadow-lg">
          <CardHeader className="gap-1.5 px-7 pt-7">
            <CardTitle className="text-2xl">Restaurant sign in</CardTitle>
            <CardDescription>Use the credentials provided by your administrator</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 px-7 pb-7">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <IconInput
                  id="email"
                  icon={Mail}
                  type="email"
                  autoComplete="email"
                  placeholder="owner@restaurant.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Lost your password? Ask your administrator to reset it.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

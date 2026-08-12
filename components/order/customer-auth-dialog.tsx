"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { extractNationalDigits, formatMobile, INDIAN_MOBILE_REGEX } from "@/lib/restaurant/mobile";
import { OverlayShell } from "@/components/order/overlay-shell";
import type { PublicRestaurant } from "@/components/order/types";

type SignedInCustomer = { name: string; mobile: string };

/**
 * No-OTP "log in with just your mobile number" (session module + routes from
 * Task 5). This is a two-step flow, not one form with both fields at once —
 * the point is that a returning guest is recognized from the number alone
 * and never asked for their name again.
 *
 * Step 1 always shows just the mobile field. The POST to
 * /api/order/customer-auth/login is made *without* a name; the route 200s
 * straight away for a known number, and 400s with the literal message
 * "Enter your name" only when the number is brand-new — that exact string is
 * what moves this dialog to step 2, keeping the mobile number already typed.
 */
export function CustomerAuthDialog({
  restaurant,
  onSignedIn,
  onClose,
  dismissible = true,
}: {
  restaurant: PublicRestaurant;
  onSignedIn: (customer: SignedInCustomer) => void;
  onClose: () => void;
  /**
   * False on the menu's arrival prompt, where a number is required before the
   * guest can browse: no close button and a dead backdrop. True everywhere
   * else — notably checkout's "Change", which must be cancellable.
   */
  dismissible?: boolean;
}) {
  const [step, setStep] = useState<"mobile" | "name">("mobile");
  // Without this the menu keeps scrolling behind the blur, which reads as
  // "the page is usable" when it deliberately isn't.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const nationalDigits = extractNationalDigits(mobile);
  const mobileValid = INDIAN_MOBILE_REGEX.test(nationalDigits);
  const mobileTouched = mobile.trim().length > 0;
  const nameValid = name.trim().length >= 2;

  async function submitLogin(body: { mobile: string; name?: string }) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/order/customer-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug: restaurant.slug, ...body }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.customer) {
        onSignedIn(data.customer);
        onClose();
        return;
      }

      // The one 400 shape that means "brand-new number" rather than an
      // actual error — advance to the name step instead of surfacing it.
      if (res.status === 400 && !body.name && data?.error === "Enter your name") {
        setStep("name");
        return;
      }

      toast.error(
        typeof data.error === "string" ? data.error : "Something went wrong. Please try again."
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleMobileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mobileValid || isLoading) return;
    submitLogin({ mobile: nationalDigits });
  }

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nameValid || isLoading) return;
    submitLogin({ mobile: nationalDigits, name: name.trim() });
  }

  return (
    <OverlayShell
      tone="identity"
      label="Sign in"
      onClose={onClose}
      dismissible={dismissible}
    >
        <header
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--resto-border)" }}
        >
          <div>
            <h2 className="resto-display text-xl font-semibold" style={{ color: "var(--resto-text)" }}>
              Sign in
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--resto-text-muted)" }}>
              {step === "mobile"
                ? "Use your mobile number — no password needed."
                : "First time here — what should we call you?"}
            </p>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70"
              style={{ color: "var(--resto-text-muted)" }}
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {step === "mobile" ? (
            <form onSubmit={handleMobileSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="customer-auth-mobile"
                  className="text-sm font-medium"
                  style={{ color: "var(--resto-text)" }}
                >
                  Mobile number
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-10 items-center px-3 text-sm"
                    style={{
                      backgroundColor: "var(--resto-surface-alt)",
                      borderRadius: "var(--resto-radius-md)",
                      color: "var(--resto-text-muted)",
                    }}
                  >
                    +91
                  </span>
                  <input
                    id="customer-auth-mobile"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={13}
                    placeholder="98765 43210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    aria-invalid={mobileTouched && !mobileValid}
                    className="h-10 w-full border px-3 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--resto-card)",
                      borderColor: "var(--resto-border)",
                      borderRadius: "var(--resto-radius-md)",
                      color: "var(--resto-text)",
                    }}
                    autoFocus
                  />
                </div>
                {mobileTouched && !mobileValid && (
                  <p className="text-xs" style={{ color: "var(--resto-error)" }}>
                    Enter a 10-digit number starting with 6, 7, 8 or 9.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!mobileValid || isLoading}
                className="resto-numeric flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: "var(--resto-brand-500)",
                  color: "var(--on-brand)",
                  borderRadius: "var(--resto-radius-full)",
                }}
              >
                {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isLoading ? "Checking…" : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleNameSubmit} className="flex flex-col gap-3">
              <p
                className="px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--resto-surface-alt)",
                  borderRadius: "var(--resto-radius-md)",
                  color: "var(--resto-text-muted)",
                }}
              >
                Signing in with{" "}
                <span className="resto-numeric font-medium" style={{ color: "var(--resto-text)" }}>
                  {formatMobile(`+91${nationalDigits}`)}
                </span>
              </p>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="customer-auth-name"
                  className="text-sm font-medium"
                  style={{ color: "var(--resto-text)" }}
                >
                  Your name
                </label>
                <input
                  id="customer-auth-name"
                  autoComplete="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 w-full border px-3 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--resto-card)",
                    borderColor: "var(--resto-border)",
                    borderRadius: "var(--resto-radius-md)",
                    color: "var(--resto-text)",
                  }}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!nameValid || isLoading}
                className="resto-numeric flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: "var(--resto-brand-500)",
                  color: "var(--on-brand)",
                  borderRadius: "var(--resto-radius-full)",
                }}
              >
                {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {isLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}
        </div>
    </OverlayShell>
  );
}

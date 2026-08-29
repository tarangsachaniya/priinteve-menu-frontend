"use client";

import { RotateCcw, Sparkles, X } from "lucide-react";

import { ScratchCardInteractive } from "@/components/order/scratch-card";
import type { ScratchCardEntry } from "@/lib/order/scratch-reveal";

/**
 * Full-screen scratch reveal (spec section 2). Wraps the same canvas engine
 * `ScratchCardInteractive` already uses inline in the rewards grid — it
 * already resizes to fill whatever container it's given, so making the
 * experience full-screen is purely a matter of the container, not the scratch
 * mechanic itself.
 *
 * Also reusable to re-open an already-revealed card at full size (isRevealed
 * derived from card.status) — a customer tapping a claimed card to look at
 * their reward again gets the same polished view, not just the small grid
 * tile.
 */
export function ScratchCardFullscreen({
  card,
  onReveal,
  onClose,
  revealFailed = false,
  onRetryReveal,
}: {
  card: ScratchCardEntry;
  /** Fires once the scratch threshold is crossed — the parent owns the actual API call. */
  onReveal: () => void;
  onClose: () => void;
  /** True when the last reveal attempt for this card failed server-side. */
  revealFailed?: boolean;
  /** Retries the same reveal call. Required whenever revealFailed can become true. */
  onRetryReveal?: () => void;
}) {
  const isRevealed = card.status !== "ISSUED";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      style={{ height: "100dvh", width: "100dvw" }}
      role="dialog"
      aria-modal="true"
      aria-label="Scratch card"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-opacity hover:opacity-70"
      >
        <X className="size-6" aria-hidden />
      </button>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="aspect-square w-full max-w-md">
          <ScratchCardInteractive onReveal={onReveal} isRevealed={isRevealed} className="text-lg font-semibold text-white">
            {isRevealed ? (
              <div className="flex flex-col items-center gap-3 text-center duration-500 animate-in fade-in zoom-in-95">
                <Sparkles className="size-10 text-white" aria-hidden />
                <p className="text-2xl font-bold text-white">{card.reward?.label ?? "Reward"}</p>
                <p className="text-sm text-white/70">
                  {card.reward?.type === "LOYALTY_POINTS"
                    ? "Added to your points balance"
                    : "Use at checkout"}
                </p>
              </div>
            ) : revealFailed ? (
              <button
                type="button"
                onClick={onRetryReveal}
                className="flex flex-col items-center gap-2 text-center"
              >
                <RotateCcw className="size-6 text-white" aria-hidden />
                <p className="text-sm font-semibold text-white">Couldn&apos;t reveal your reward</p>
                <span className="text-xs font-semibold text-white underline underline-offset-2">Tap to try again</span>
              </button>
            ) : (
              <span className="text-sm text-white/70">Revealing…</span>
            )}
          </ScratchCardInteractive>
        </div>
      </div>

      {isRevealed && (
        <div className="p-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

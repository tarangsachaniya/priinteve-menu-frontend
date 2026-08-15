"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";

/**
 * Asked once, after the invoice is paid.
 *
 * The rating is one tap and the comment is optional, because the moment this
 * appears the guest is standing up to leave. Anything longer gets skipped, and
 * a skipped review is worth less than a bare four stars.
 */
export function ReviewPrompt({ orderId, onSubmitted }: { orderId: string; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating === 0) {
      toast.error("Tap a star to rate your meal");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/order/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not save your review");
        return;
      }
      toast.success("Thanks for the feedback!");
      onSubmitted();
    } finally {
      setIsSaving(false);
    }
  }

  const shown = hovered || rating;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col items-center gap-3 border p-5 text-center"
      style={{
        backgroundColor: "var(--resto-card)",
        borderColor: "var(--resto-border)",
        borderRadius: "var(--resto-radius-lg)",
      }}
    >
      <div>
        <p className="resto-display text-lg font-semibold" style={{ color: "var(--resto-text)" }}>
          How was your meal?
        </p>
        <p className="mt-0.5 text-sm" style={{ color: "var(--resto-text-muted)" }}>
          Your rating helps other guests decide.
        </p>
      </div>

      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            aria-pressed={rating === star}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className="size-8"
              style={{
                fill: star <= shown ? "var(--resto-gold)" : "transparent",
                color: star <= shown ? "var(--resto-gold)" : "var(--resto-text-subtle)",
              }}
              aria-hidden
            />
          </button>
        ))}
      </div>

      {/* The comment box only appears after a rating, so the first interaction
          is always the cheap one. */}
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Anything you'd like to add? (optional)"
            className="w-full resize-none border p-3 text-sm outline-none placeholder:text-[var(--resto-text-subtle)]"
            style={{
              backgroundColor: "var(--resto-bg)",
              borderColor: "var(--resto-border)",
              borderRadius: "var(--resto-radius-md)",
              color: "var(--resto-text)",
            }}
          />
          <button
            type="submit"
            disabled={isSaving}
            className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
            style={{
              backgroundColor: "var(--resto-brand-500)",
              color: "var(--on-brand)",
              borderRadius: "var(--resto-radius-full)",
            }}
          >
            {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isSaving ? "Sending…" : "Submit review"}
          </button>
        </>
      )}
    </form>
  );
}

import { Star } from "lucide-react";

import { formatRating } from "@/lib/restaurant/menu-display";
import {
  REVIEW_DISPLAY_THRESHOLD,
  relativeDay,
  reviewerLabel,
  type ReviewSummary,
} from "@/lib/restaurant/reviews";

/**
 * Guest reviews, at the foot of the menu.
 *
 * Renders nothing at all until the restaurant has passed the threshold. The
 * alternative — an empty "No reviews yet" block on every new listing — is a
 * worse answer than silence, because it draws attention to the absence on
 * exactly the pages that can least afford it.
 */
export function ReviewsSection({ summary }: { summary: ReviewSummary }) {
  if (!summary.isPublished || summary.reviews.length === 0) return null;

  const rating = formatRating(summary.ratingValue);
  const max = Math.max(...summary.distribution, 1);

  return (
    <section className="mt-10">
      <h2 className="resto-display text-xl font-semibold" style={{ color: "var(--resto-text)" }}>
        What guests say
      </h2>

      <div
        className="mt-4 flex flex-col gap-6 border p-5 sm:flex-row sm:items-center"
        style={{
          backgroundColor: "var(--resto-card)",
          borderColor: "var(--resto-border)",
          borderRadius: "var(--resto-radius-lg)",
        }}
      >
        <div className="flex shrink-0 flex-col items-center gap-1 sm:w-40">
          <p
            className="resto-display resto-numeric text-4xl font-bold"
            style={{ color: "var(--resto-text)" }}
          >
            {rating}
          </p>
          <Stars value={summary.ratingValue ?? 0} />
          <p className="resto-numeric text-xs" style={{ color: "var(--resto-text-muted)" }}>
            {summary.ratingCount} {summary.ratingCount === 1 ? "review" : "reviews"}
          </p>
        </div>

        {/* Five-to-one, because that is the order people read a rating
            breakdown in. */}
        <dl className="min-w-0 flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[star - 1] ?? 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <dt
                  className="resto-numeric w-3 shrink-0 text-right"
                  style={{ color: "var(--resto-text-muted)" }}
                >
                  {star}
                </dt>
                <Star
                  className="size-3 shrink-0"
                  style={{ fill: "var(--resto-gold)", color: "var(--resto-gold)" }}
                  aria-hidden
                />
                <dd className="flex min-w-0 flex-1 items-center gap-2">
                  <span
                    className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--resto-surface-alt)" }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(count / max) * 100}%`,
                        backgroundColor: "var(--resto-gold)",
                      }}
                    />
                  </span>
                  <span
                    className="resto-numeric w-6 shrink-0 text-right"
                    style={{ color: "var(--resto-text-muted)" }}
                  >
                    {count}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {summary.reviews.map((review) => (
          <li
            key={review.id}
            className="border p-4"
            style={{
              backgroundColor: "var(--resto-card)",
              borderColor: "var(--resto-border)",
              borderRadius: "var(--resto-radius-lg)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <p
                className="resto-display text-sm font-semibold"
                style={{ color: "var(--resto-text)" }}
              >
                {reviewerLabel(review.customerName)}
              </p>
              <span className="text-[11px]" style={{ color: "var(--resto-text-subtle)" }}>
                {relativeDay(review.createdAt)}
              </span>
            </div>
            <div className="mt-1">
              <Stars value={review.rating * 10} />
            </div>
            {review.comment && (
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--resto-text-muted)" }}
              >
                {review.comment}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** `value` is a rating ×10, matching how ratings are stored throughout. */
function Stars({ value }: { value: number }) {
  const filled = Math.round(value / 10);
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${(value / 10).toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className="size-3.5"
          style={{
            fill: star <= filled ? "var(--resto-gold)" : "transparent",
            color: star <= filled ? "var(--resto-gold)" : "var(--resto-text-subtle)",
          }}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** Shown to the owner, not the guest — see the settings screen. */
export function reviewsPendingLabel(summary: ReviewSummary): string {
  return summary.isPublished
    ? "Live on your menu"
    : `${summary.remaining} more review${summary.remaining === 1 ? "" : "s"} until ratings show (${REVIEW_DISPLAY_THRESHOLD} needed)`;
}

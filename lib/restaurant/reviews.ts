/**
 * Guest reviews, and the rule about when they are allowed to speak.
 *
 * A restaurant that has been open a week and has one five-star review does not
 * have a 5.0 rating — it has one happy customer and no evidence. Showing a
 * headline score off two or three ratings is how a directory becomes useless:
 * every new listing is a 5.0 and nothing distinguishes them.
 *
 * So real reviews stay hidden until there are enough of them to mean anything.
 * Below the threshold the page falls back to the owner-entered display rating,
 * which is clearly a claim rather than a measurement.
 */

/** Reviews needed before the aggregate is shown. */
export const REVIEW_DISPLAY_THRESHOLD = 10;

/** How many individual reviews the menu lists under the score. */
export const REVIEW_PREVIEW_COUNT = 5;

export type PublicReview = {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
};

export type ReviewSummary = {
  /** True once there are enough real reviews to publish an aggregate. */
  isPublished: boolean;
  /** Rating ×10, matching how Restaurant.ratingValue is stored. */
  ratingValue: number | null;
  ratingCount: number;
  /** How many more reviews are needed. Zero once published. */
  remaining: number;
  /** Count per star, 1-indexed at [0]=1★ … [4]=5★. Empty until published. */
  distribution: number[];
  reviews: PublicReview[];
};

/**
 * Folds raw reviews into what the page renders.
 *
 * `fallback` is the owner-entered pair from the Restaurant row. It is used
 * only while the real reviews are below threshold, and is dropped entirely
 * once they are not — a measured 4.2 must never be quietly averaged with a
 * self-reported 4.9.
 */
export function summariseReviews({
  reviews,
  fallback,
}: {
  reviews: { id: string; customerName: string; rating: number; comment: string | null; createdAt: Date }[];
  fallback: { ratingValue: number | null; ratingCount: number | null };
}): ReviewSummary {
  const count = reviews.length;

  if (count < REVIEW_DISPLAY_THRESHOLD) {
    return {
      isPublished: false,
      ratingValue: fallback.ratingValue,
      ratingCount: fallback.ratingCount ?? 0,
      remaining: REVIEW_DISPLAY_THRESHOLD - count,
      distribution: [],
      reviews: [],
    };
  }

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  const distribution = [0, 0, 0, 0, 0];
  for (const review of reviews) distribution[review.rating - 1] += 1;

  return {
    isPublished: true,
    // ×10 and rounded, so 4.25 stores as 43 and renders as "4.3".
    ratingValue: Math.round((total / count) * 10),
    ratingCount: count,
    remaining: 0,
    distribution,
    reviews: reviews.slice(0, REVIEW_PREVIEW_COUNT).map((review) => ({
      id: review.id,
      customerName: review.customerName,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    })),
  };
}

/** "2 days ago" — reviews need recency, not a timestamp. */
export function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** First name only — a full name next to a complaint is more than was agreed to. */
export function reviewerLabel(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || "Guest";
}

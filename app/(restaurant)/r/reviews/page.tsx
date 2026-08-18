import { redirect } from "next/navigation";
import { Star } from "lucide-react";

import { getRestaurantSession, serverFetch } from "@/lib/api/server";
import { REVIEW_DISPLAY_THRESHOLD } from "@/lib/restaurant/reviews";
import { formatRating } from "@/lib/restaurant/menu-display";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { ReviewVisibilityToggle } from "@/components/restaurant/review-visibility-toggle";

export const dynamic = "force-dynamic";

type ReviewRow = {
  id: string;
  customerName: string;
  rating: number;
  comment: string | null;
  isHidden: boolean;
  createdAt: string;
  orderNumber: number;
};

type ReviewsResponse = {
  reviews: ReviewRow[];
  summary: { isPublished: boolean; ratingValue: number | null; ratingCount: number; remaining: number };
};

/** "2 days ago" — reviews need recency, not a timestamp. */
function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

export default async function RestaurantReviewsPage() {
  const sessionData = await getRestaurantSession();
  if (!sessionData) redirect("/r/login");

  const { reviews: all, summary } = await serverFetch<ReviewsResponse>("/api/restaurant/reviews", {
    cache: "no-store",
  });

  return (
    <PageShell
      width="reading"
      icon={Star}
      title="Reviews"
      description="Guests are asked to rate their meal once they've paid."
    >
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-6 p-5">
          <div>
            <p className="text-3xl font-bold tabular-nums">
              {summary.isPublished ? formatRating(summary.ratingValue) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.ratingCount} {summary.ratingCount === 1 ? "review" : "reviews"}
            </p>
          </div>
          <p
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              summary.isPublished ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
            }`}
          >
            {summary.isPublished
              ? "Your rating is live on your menu."
              : `${summary.remaining} more review${summary.remaining === 1 ? "" : "s"} needed. Ratings appear on your menu once you reach ${REVIEW_DISPLAY_THRESHOLD}, so a handful of early ratings can't set your score.`}
          </p>
        </CardContent>
      </Card>

      {all.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          description="Guests see the rating prompt on their order page as soon as you mark their order paid."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {all.map((review) => (
            <li key={review.id}>
              <Card className={review.isHidden ? "opacity-60" : undefined}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`size-3.5 ${
                              star <= review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </span>
                      <span className="text-sm font-medium">{review.customerName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Order #{review.orderNumber} · {relativeDay(review.createdAt)}
                    </span>
                  </div>

                  {review.comment && <p className="text-sm leading-relaxed text-muted-foreground">{review.comment}</p>}

                  <ReviewVisibilityToggle id={review.id} isHidden={review.isHidden} />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

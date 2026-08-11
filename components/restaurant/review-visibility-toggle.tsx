"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Hide or restore a review.
 *
 * Hiding, never deleting. A restaurant that can erase criticism has a rating
 * that means nothing, and a hidden review still exists if the guest disputes
 * what happened. Hidden reviews are excluded from the average, so the count on
 * the menu always matches the reviews shown beneath it.
 */
export function ReviewVisibilityToggle({ id, isHidden }: { id: string; isHidden: boolean }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function toggle() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/restaurant/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !isHidden }),
      });
      if (!res.ok) {
        toast.error("Could not update the review");
        return;
      }
      toast.success(isHidden ? "Review is visible again" : "Review hidden from your menu");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-t border-border pt-2">
      {isHidden && (
        <span className="text-xs font-medium text-muted-foreground">
          Hidden from your menu and excluded from your rating
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="ml-auto"
        disabled={isSaving}
        onClick={toggle}
      >
        {isHidden ? <Eye data-icon="inline-start" /> : <EyeOff data-icon="inline-start" />}
        {isHidden ? "Show" : "Hide"}
      </Button>
    </div>
  );
}

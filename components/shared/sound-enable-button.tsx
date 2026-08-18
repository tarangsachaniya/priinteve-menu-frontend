import { Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The amber "do something about sound" button — one visual treatment shared
 * by two screens that show it for different reasons and at different sizes.
 *
 * KitchenDisplay shows this proactively, in its header, before any order has
 * even arrived — a wall tablet gets one gesture, ever, and asking for it
 * early is the point (see that component's own comment on why). The console's
 * OrderAlertProvider shows a smaller version of the same button, and only
 * reactively, after a real alert has genuinely been refused — showing it
 * speculatively there used to read as a mandatory setup step. Those triggers
 * are deliberately different and this component does not touch either; it
 * only makes sure that whichever one fires, the button looks like the same
 * affordance rather than two shades of amber that happen to be near each
 * other in the codebase.
 */
export function SoundEnableButton({
  label,
  onClick,
  size = "md",
}: {
  label: string;
  onClick: () => void;
  /** "md" for a standalone header prompt, "sm" for one nested inside a dialog or pill. */
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl bg-amber-500/15 text-left font-semibold text-amber-900 transition-colors hover:bg-amber-500/25",
        size === "md" ? "px-3.5 py-2.5 text-sm" : "px-3 py-2 text-xs font-medium",
      )}
    >
      <Volume2 className={cn("shrink-0", size === "md" ? "size-5" : "size-4")} />
      {label}
    </button>
  );
}

import { cn } from "@/lib/utils";

/**
 * The mockups in "Mobile application UI mockups/" are all authored against a
 * 402 x 874 iPhone viewport. Rather than re-flowing each screen to whatever
 * width the layout gives it, the screen is laid out at its native size and
 * the whole frame is scaled — so the 12px paddings and 10.5px labels the
 * mockups specify stay in the proportion they were designed at, and one
 * `scale` prop drives every size the page needs.
 */
const SCREEN_W = 402;
const SCREEN_H = 874;

export function PhoneFrame({
  children,
  scale = 0.58,
  className,
}: {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: SCREEN_W * scale, height: SCREEN_H * scale }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: SCREEN_W, height: SCREEN_H, transform: `scale(${scale})` }}
      >
        <div className="size-full rounded-[58px] bg-ink p-3 shadow-[0_40px_80px_-32px_rgb(23_21_18_/_0.45)]">
          <div className="relative size-full overflow-hidden rounded-[46px] bg-card">
            <div className="absolute top-4 left-1/2 z-20 h-[30px] w-[104px] -translate-x-1/2 rounded-full bg-ink" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stand-in for the mockups' <image-slot> dish photos — no assets shipped yet. */
export function PhotoSlot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-mint to-background",
        className
      )}
      aria-hidden
    >
      <span className="size-4 rounded-full border-2 border-mint-ink/25" />
    </div>
  );
}

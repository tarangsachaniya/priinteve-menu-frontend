import { cn } from "@/lib/utils"

type SectionHeaderProps = {
  eyebrow: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: "left" | "center"
  tone?: "light" | "dark"
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
  tone = "light",
  className,
}: SectionHeaderProps) {
  const dark = tone === "dark"
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold tracking-[0.2em] uppercase",
          dark ? "text-ink-muted" : "text-muted-foreground"
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl",
          dark ? "text-white" : "text-foreground"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed sm:text-lg",
            dark ? "text-ink-muted" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}

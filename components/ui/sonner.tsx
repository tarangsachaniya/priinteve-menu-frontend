"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: true,
        classNames: {
          // `unstyled` drops sonner's own layout CSS, so this is the whole
          // shape now: an elevated pill matching the app's card language
          // (rounded-2xl, shadow, border) rather than the flat, colourless
          // default. Icon colour comes from `currentColor`, so tinting text
          // here is what tints the icon too — no per-icon colour needed.
          toast:
            "flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-lg bg-popover text-popover-foreground border-border",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
          icon: "shrink-0 [&_svg]:size-4.5",
          success:
            "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/25",
          error:
            "bg-red-50 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/25",
          warning:
            "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/25",
          info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/25",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

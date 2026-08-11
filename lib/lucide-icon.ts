import * as LucideIcons from "lucide-react";
import { Sparkles, type LucideIcon } from "lucide-react";

export function resolveLucideIcon(name: string | undefined): LucideIcon {
  if (!name) return Sparkles;
  const icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  return icon ?? Sparkles;
}

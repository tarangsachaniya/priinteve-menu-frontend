"use client";

import { useRef } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Pieces shared across the settings sub-pages that used to be one 841-line
 * form.
 *
 * Splitting Settings into routes (profile / ordering / payments / sounds /
 * screens / hours / invoice — see app/(restaurant)/r/settings/layout.tsx) put
 * these three in every section that touches an image, a toggle, or a Zod
 * error. Kept together here rather than duplicated per section, which is how
 * the original file drifted into one Save button covering eight unrelated
 * concerns in the first place.
 */

/**
 * Shared by the cover photo and the logo — same upload flow, different
 * preview shape (wide strip vs. square) since that's how each is actually
 * displayed on the customer menu — see restaurant-hero.tsx.
 */
export function ImageUploadField({
  label,
  hint,
  shape,
  imageUrl,
  isUploading,
  onUpload,
  onRemove,
}: {
  label: string;
  hint: string;
  shape: "wide" | "square";
  imageUrl: string;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xl border border-border bg-muted",
            shape === "wide" ? "h-16 w-28" : "size-16",
          )}
        >
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt=""
              className={cn("size-full", shape === "wide" ? "object-cover" : "object-contain")}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImagePlus className="size-5" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ImagePlus data-icon="inline-start" />
              )}
              {isUploading ? "Uploading…" : imageUrl ? "Replace" : "Upload"}
            </Button>
            {imageUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
    </div>
  );
}

export function ToggleRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 p-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Matches the visible <Label> text across every settings sub-page, so a
 * validation error and the field it names never disagree.
 *
 * One shared map rather than one per section: several of these fields — the
 * rating pair, the payment flags — can be reported from either
 * settingsInvariantIssue() on the API or restaurantSettingsSchema on the
 * client, and both walk the same field names.
 */
export const SETTINGS_FIELD_LABELS: Record<string, string> = {
  name: "Restaurant name",
  branch: "Branch / Area",
  phone: "Phone",
  email: "Email",
  address: "Address",
  brandColor: "Brand colour",
  themeMode: "Theme mode",
  coverImageUrl: "Cover photo",
  coverPublicId: "Cover photo",
  logoUrl: "Logo",
  logoPublicId: "Logo",
  tagline: "Tagline",
  description: "Description",
  cuisineTags: "Cuisine tags",
  prepTimeMinMins: "Prep time, from",
  prepTimeMaxMins: "Prep time, to",
  costForTwo: "Cost for two",
  ratingValue: "Starting rating",
  ratingCount: "Based on how many reviews",
  dineInEnabled: "Order types",
  takeAwayEnabled: "Order types",
  deliveryEnabled: "Order types",
  onlinePaymentEnabled: "Payments",
  counterPaymentEnabled: "Payments",
  upiQrEnabled: "Payments",
  upiVpa: "UPI ID",
  upiPayeeName: "UPI payee name",
  legalName: "Registered business name",
  gstin: "GSTIN",
  fssaiLicence: "FSSAI licence number",
  taxPercent: "Tax (%)",
  taxInclusive: "GST pricing",
  deliveryFee: "Delivery fee (₹)",
  minOrderValue: "Minimum order (₹)",
};

/**
 * Zod's own message never says which field failed, and on a form of any size
 * "Invalid input" gives the owner no way to know which section broke.
 */
export function describeSettingsIssue(
  issue: { path: PropertyKey[]; message: string } | undefined,
): string {
  if (!issue) return "Check your settings";
  const field = issue.path[0];
  const label = typeof field === "string" ? SETTINGS_FIELD_LABELS[field] : undefined;
  return label ? `${label}: ${issue.message}` : issue.message;
}

/**
 * Saves one section's fields via PATCH /api/restaurant/settings.
 *
 * The route accepts a genuine partial (see restaurantSettingsPatchSchema on
 * the API) and checks cross-field rules against the STORED row merged with
 * this patch — so it is correct to send only the keys this section actually
 * edited, and every other section's values are left untouched server-side.
 */
export async function patchRestaurantSettings(
  patch: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/restaurant/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: typeof data.error === "string" ? data.error : "Could not save settings" };
}

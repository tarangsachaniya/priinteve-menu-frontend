"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { uploadDirect } from "@/lib/upload";
import { formatMobile } from "@/lib/restaurant/mobile";
import { REVIEW_DISPLAY_THRESHOLD } from "@/lib/restaurant/reviews";
import { restaurantSettingsPatchSchema } from "@/lib/validations/restaurant";
import {
  describeSettingsIssue,
  ImageUploadField,
  patchRestaurantSettings,
} from "@/components/restaurant/settings/shared";

export type ProfileSettings = {
  name: string;
  branch: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  brandColor: string;
  coverImageUrl: string | null;
  coverPublicId: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  tagline: string | null;
  description: string | null;
  cuisineTags: string[];
  prepTimeMinMins: number | null;
  prepTimeMaxMins: number | null;
  costForTwo: number | null;
  /** Stored ×10, e.g. 45 for "4.5" — see Restaurant.ratingValue. */
  ratingValue: number | null;
  ratingCount: number | null;
};

/** Only the keys this section edits — every other section's fields are left alone server-side. */
const PROFILE_FIELDS = [
  "name",
  "branch",
  "phone",
  "email",
  "address",
  "brandColor",
  "coverImageUrl",
  "coverPublicId",
  "logoUrl",
  "logoPublicId",
  "tagline",
  "description",
  "cuisineTags",
  "prepTimeMinMins",
  "prepTimeMaxMins",
  "costForTwo",
  "ratingValue",
  "ratingCount",
] as const;

const profilePatchSchema = restaurantSettingsPatchSchema.pick(
  Object.fromEntries(PROFILE_FIELDS.map((f) => [f, true])) as Record<
    (typeof PROFILE_FIELDS)[number],
    true
  >,
);

/**
 * Identity, branding and how the restaurant presents itself to a guest —
 * everything on the menu page above the food.
 *
 * Was one card of a five-card form that saved as a single object. Splitting
 * Settings into routes only pays off if this genuinely saves independently:
 * the payload here carries exactly PROFILE_FIELDS, and PATCH /restaurant/
 * settings merges it onto the stored row rather than requiring the rest.
 */
export function ProfileSettingsForm({
  settings,
  publishedReviews,
}: {
  settings: ProfileSettings;
  /** Non-hidden guest reviews — the count that decides the rating lock below. */
  publishedReviews: number;
}) {
  const ratingLocked = publishedReviews >= REVIEW_DISPLAY_THRESHOLD;

  const [form, setForm] = useState({
    ...settings,
    branch: settings.branch ?? "",
    phone: settings.phone ? formatMobile(settings.phone) : "",
    email: settings.email ?? "",
    address: settings.address ?? "",
    coverImageUrl: settings.coverImageUrl ?? "",
    coverPublicId: settings.coverPublicId ?? "",
    logoUrl: settings.logoUrl ?? "",
    logoPublicId: settings.logoPublicId ?? "",
    tagline: settings.tagline ?? "",
    description: settings.description ?? "",
    // Edited as one comma-separated field rather than a chip picker — six
    // short tags at most, and a text field is one control instead of five.
    cuisineTags: settings.cuisineTags.join(", "),
    prepTimeMinMins: settings.prepTimeMinMins == null ? "" : String(settings.prepTimeMinMins),
    prepTimeMaxMins: settings.prepTimeMaxMins == null ? "" : String(settings.prepTimeMaxMins),
    costForTwo: settings.costForTwo == null ? "" : String(settings.costForTwo),
    // Stored ×10; edited the way an owner reads it — "4.5", not "45".
    ratingValue: settings.ratingValue == null ? "" : String(settings.ratingValue / 10),
    ratingCount: settings.ratingCount == null ? "" : String(settings.ratingCount),
  });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * One upload endpoint, parameterised by `kind` — the server uses it to name
   * the S3 object, which is the only thing the two differ by. Both are stored
   * at the same size and shaped on delivery instead: the cover fills a 16:9
   * strip and the logo is fitted inside a square, and object-fit is what
   * decides that. See priinteve-api/src/routes/restaurant/settings.routes.ts.
   */
  async function handleImageUpload(kind: "cover" | "logo", file: File) {
    const setUploading = kind === "cover" ? setUploadingCover : setUploadingLogo;
    setUploading(true);
    try {
      const data = await uploadDirect(file, "/api/restaurant/settings/upload-url", {
        extra: { kind },
      });
      if (kind === "cover") {
        update("coverImageUrl", data.imageUrl as string);
        update("coverPublicId", data.imagePublicId as string);
      } else {
        update("logoUrl", data.imageUrl as string);
        update("logoPublicId", data.imagePublicId as string);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = profilePatchSchema.safeParse({
      ...form,
      cuisineTags: form.cuisineTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      toast.error(describeSettingsIssue(parsed.error.issues[0]));
      return;
    }

    setIsSaving(true);
    try {
      const result = await patchRestaurantSettings(parsed.data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile saved");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Restaurant profile</CardTitle>
          <p className="text-sm text-muted-foreground">What customers see at the top of your menu.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-name">Restaurant name</Label>
              <Input
                id="settings-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-branch">Branch / Area</Label>
              <Input
                id="settings-branch"
                value={form.branch}
                onChange={(e) => update("branch", e.target.value)}
                placeholder="Bandra West"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-phone">Phone</Label>
              <Input
                id="settings-phone"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="9876543210"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-address">Address</Label>
            <Textarea
              id="settings-address"
              rows={3}
              value={form.address}
              onChange={(e) => update("address", e.target.value)}
              placeholder={"Shop 4, Linking Road\nBandra West, Mumbai\nMaharashtra 400050"}
            />
            <p className="text-xs text-muted-foreground">
              Printed on every invoice — use your full postal address, including city, state and
              pincode.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-color">Brand colour</Label>
            <div className="flex items-center gap-3">
              <input
                id="settings-color"
                type="color"
                value={form.brandColor}
                onChange={(e) => update("brandColor", e.target.value)}
                className="size-10 cursor-pointer rounded-xl border border-border bg-transparent p-1"
              />
              <Input
                value={form.brandColor}
                onChange={(e) => update("brandColor", e.target.value)}
                className="max-w-32 font-mono"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Used for accents on your customer-facing menu.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ImageUploadField
              label="Cover photo"
              hint="Shown behind your name at the top of the menu. 16:9 works best."
              shape="wide"
              imageUrl={form.coverImageUrl}
              isUploading={uploadingCover}
              onUpload={(file) => handleImageUpload("cover", file)}
              onRemove={() => {
                update("coverImageUrl", "");
                update("coverPublicId", "");
              }}
            />
            <ImageUploadField
              label="Logo"
              hint="Shown on a card over the cover photo. Square works best."
              shape="square"
              imageUrl={form.logoUrl}
              isUploading={uploadingLogo}
              onUpload={(file) => handleImageUpload("logo", file)}
              onRemove={() => {
                update("logoUrl", "");
                update("logoPublicId", "");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="text-base">Presentation</CardTitle>
          <p className="text-sm text-muted-foreground">
            The facts a guest checks before ordering — tagline, description, prep time and cost.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-tagline">Tagline</Label>
            <Input
              id="settings-tagline"
              value={form.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="Wood-fired kitchen · Modern Indian & Grill"
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-description">Description</Label>
            <Textarea
              id="settings-description"
              rows={3}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What makes your kitchen worth ordering from."
              maxLength={400}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="settings-cuisine">Cuisine tags</Label>
            <Input
              id="settings-cuisine"
              value={form.cuisineTags}
              onChange={(e) => update("cuisineTags", e.target.value)}
              placeholder="North Indian, Chinese, Tandoor"
            />
            <p className="text-xs text-muted-foreground">
              Up to 6, separated by commas. Shown above your name if you haven&apos;t set a
              tagline.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-prep-min">Prep time, from (min)</Label>
              <Input
                id="settings-prep-min"
                type="number"
                min={0}
                value={form.prepTimeMinMins}
                onChange={(e) => update("prepTimeMinMins", e.target.value)}
                placeholder="20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-prep-max">Prep time, to (min)</Label>
              <Input
                id="settings-prep-max"
                type="number"
                min={0}
                value={form.prepTimeMaxMins}
                onChange={(e) => update("prepTimeMaxMins", e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-cost-for-two">Cost for two (₹)</Label>
              <Input
                id="settings-cost-for-two"
                type="number"
                min={0}
                value={form.costForTwo}
                onChange={(e) => update("costForTwo", e.target.value)}
                placeholder="900"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-rating">Starting rating (1–5)</Label>
              <Input
                id="settings-rating"
                type="number"
                min={1}
                max={5}
                step={0.1}
                value={form.ratingValue}
                onChange={(e) => update("ratingValue", e.target.value)}
                placeholder="4.5"
                disabled={ratingLocked}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="settings-rating-count">Based on how many reviews</Label>
              <Input
                id="settings-rating-count"
                type="number"
                min={0}
                value={form.ratingCount}
                onChange={(e) => update("ratingCount", e.target.value)}
                placeholder="120"
                disabled={ratingLocked}
              />
            </div>
          </div>
          {/* The disabling is only the explanation — the settings route ignores
              these two fields once locked, whatever the form sends. */}
          {ratingLocked ? (
            <p className="text-xs text-muted-foreground">
              Your rating now comes from {publishedReviews} guest reviews, so this starting value
              is no longer used and can&apos;t be changed.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Shown until real guest reviews take over — once {REVIEW_DISPLAY_THRESHOLD} paid
              orders have been rated, your menu switches to the measured average automatically and
              these fields lock.
            </p>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSaving} className="self-start">
        {isSaving ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

import { z } from "zod";

import { INDIAN_MOBILE_REGEX, extractNationalDigits } from "@/lib/restaurant/mobile";
import { isValidGstin, normalizeGstin } from "@/lib/restaurant/gst";
import { MAX_PEAK_WINDOWS_PER_DAY } from "@/lib/restaurant/peak-hours";
import { RESTO_MODE_IDS } from "@/lib/restaurant/theme";
import { isValidVpa } from "@/lib/restaurant/upi";

/**
 * Every zod schema for the restaurant ordering module, following the
 * lib/validations/* convention used by the card product.
 */

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #16A34A");

/**
 * A cleared number input posts "", which coerces to 0 — and 0 is a meaningful
 * value for most of these fields. Everything optional therefore routes through
 * here so "cleared" stays distinguishable from "zero".
 */
const emptyToNull = (value: unknown) =>
  value === "" || value === null || value === undefined ? null : value;

function optionalInt(max: number) {
  return z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(max).nullable()).optional();
}

/**
 * Owners type a rating the way they'd read it ("4.7"); storage is ×10 — see
 * Restaurant.ratingValue for why the schema avoids floats. Used where a
 * schema is only ever parsed once, immediately before a database write, so
 * transforming straight to the ×10 storage form here is safe.
 */
const optionalDisplayRating = z
  .preprocess(emptyToNull, z.coerce.number().min(1, "Ratings run from 1.0 to 5.0").max(5, "Ratings run from 1.0 to 5.0").nullable())
  .optional()
  .transform((value) => (value === null || value === undefined ? null : Math.round(value * 10)));

/**
 * Same 1.0–5.0 validation, without the ×10 transform.
 *
 * restaurantSettingsSchema is parsed TWICE on one save — once client-side
 * before the request is sent, and again server-side on receipt — so its
 * output has to be a stable wire format both ends agree on. optionalDisplayRating
 * doesn't survive that: the client would transform "4.7" to 47 and send 47
 * over the wire, and the server would then run the same 1.0–5.0 bounds check
 * against 47 and reject every non-null rating. This variant keeps the value
 * as the decimal an owner actually typed at every step; the ×10 scaling
 * happens exactly once, right before the database write, in
 * app/api/restaurant/settings/route.ts.
 */
const optionalDisplayRatingRaw = z
  .preprocess(emptyToNull, z.coerce.number().min(1, "Ratings run from 1.0 to 5.0").max(5, "Ratings run from 1.0 to 5.0").nullable())
  .optional();

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable()).optional();

/** Accepts any of "9876543210", "+91 98765 43210", "09876543210". */
export const mobileSchema = z
  .string()
  .trim()
  .refine((value) => INDIAN_MOBILE_REGEX.test(extractNationalDigits(value)), {
    message: "Enter a valid 10-digit Indian mobile number",
  });

// ─── Admin: restaurants ────────────────────────────────────────────────────

export const restaurantCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  // Required: two outlets of the same brand are the normal case this module
  // is built for, and the branch is what keeps their slugs, QR codes and
  // owner logins from colliding. A single-outlet business types its area or
  // "Main" — there is no reading of "restaurant" here that has no location.
  branch: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
    .min(2)
    .max(60)
    .optional(),
  ownerName: z.string().trim().min(2).max(80),
  ownerEmail: z.string().trim().toLowerCase().email(),
  // Required: the admin sets the owner's first password directly rather than
  // a generated one being the only path, so it can be something the admin
  // reads out over a phone call without a typo risk.
  ownerPassword: z.string().min(8).max(72),
  phone: mobileSchema.optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  /**
   * How many tables to generate with the restaurant, labelled "Table 1"…"N".
   * Zero is legitimate — a takeaway-only kitchen has no tables — so this is a
   * plain default rather than a required field.
   */
  tableCount: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).max(200).nullable()
  ).optional().transform((value) => value ?? 0),
});

export const restaurantUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  branch: z.string().trim().max(60).optional().or(z.literal("")),
  phone: mobileSchema.optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const ownerPasswordResetSchema = z.object({
  password: z.string().min(8).max(72),
});

// ─── Restaurant: auth ──────────────────────────────────────────────────────

export const restaurantLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// ─── Restaurant: settings ──────────────────────────────────────────────────

/**
 * The field map on its own, without the cross-field rules below.
 *
 * Split out because `.partial()` is a method on ZodObject and the refined
 * schema is a ZodEffects, which has none — so a PATCH payload has nothing to
 * validate against unless the bare object is reachable. Deliberately NOT
 * exported: anything that parsed with this alone would skip every invariant in
 * settingsInvariantIssue(), which is the whole point of the split.
 *
 * NONE of these fields may carry `.default(...)`. `.partial()` only makes a
 * key optional to send — in zod 4 it does NOT suppress `.default()`, so an
 * omitted key still comes back with its default value rather than genuinely
 * missing. restaurantSettingsPatchSchema below is `.partial()`'d straight off
 * this object specifically so that "the client didn't send this field" and
 * "the client explicitly reset it" stay distinguishable all the way into the
 * PATCH route's `"key" in rest` / `rest.key ?? before.key` merge — that merge
 * only works if an absent key is actually absent. (This bit the platform once
 * already: upiQrEnabled/taxInclusive/cuisineTags used to default here, which
 * meant every settings-section save silently reset whichever of the three it
 * didn't itself show. See restaurantSettingsSchema below for where defaulting
 * belongs instead — the whole-form path, which always sends every field. Kept
 * in lockstep with priinteve-api/src/validations/restaurant.ts — see that
 * file's copy of this comment for the same fix on the server side.)
 */
const restaurantSettingsBaseFields = z
  .object({
    name: z.string().trim().min(2).max(80),
    branch: z.string().trim().max(60).optional().or(z.literal("")),
    phone: mobileSchema.optional().or(z.literal("")),
    email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
    address: z.string().trim().max(300).optional().or(z.literal("")),
    brandColor: hexColor,
    dineInEnabled: z.boolean(),
    takeAwayEnabled: z.boolean(),
    deliveryEnabled: z.boolean(),
    onlinePaymentEnabled: z.boolean(),
    counterPaymentEnabled: z.boolean(),
    upiQrEnabled: z.boolean(),
    upiVpa: optionalText(80),
    upiPayeeName: optionalText(80),

    // Tax invoice identity. All optional — a restaurant without a GSTIN still
    // issues bills, just not tax invoices.
    legalName: optionalText(120),
    gstin: z.preprocess(
      (v) => (v === "" || v == null ? null : normalizeGstin(String(v))),
      z.string().nullable()
    ).optional(),
    fssaiLicence: optionalText(20),
    taxPercent: z.coerce.number().int().min(0).max(50),
    // See Restaurant.taxInclusive's schema comment for what this controls.
    // Defaulted only in restaurantSettingsSchema below, never here.
    taxInclusive: z.coerce.boolean(),
    deliveryFee: z.coerce.number().int().min(0).max(10000),
    minOrderValue: z.coerce.number().int().min(0).max(100000),

    // Presentation — how the restaurant appears above its menu.
    coverImageUrl: optionalText(500),
    coverPublicId: optionalText(200),
    logoUrl: optionalText(500),
    logoPublicId: optionalText(200),
    tagline: optionalText(120),
    description: optionalText(400),
    cuisineTags: z.array(z.string().trim().min(1).max(24)).max(6),
    prepTimeMinMins: optionalInt(240),
    prepTimeMaxMins: optionalInt(240),
    costForTwo: optionalInt(100000),
    ratingValue: optionalDisplayRatingRaw,
    ratingCount: optionalInt(10000000),
    themeMode: z.enum(RESTO_MODE_IDS),
  });

/** Just the fields the cross-field rules below actually read. */
export type SettingsInvariantInput = {
  dineInEnabled: boolean;
  takeAwayEnabled: boolean;
  deliveryEnabled: boolean;
  onlinePaymentEnabled: boolean;
  counterPaymentEnabled: boolean;
  upiQrEnabled: boolean;
  upiVpa?: string | null;
  gstin?: string | null;
  prepTimeMinMins?: number | null;
  prepTimeMaxMins?: number | null;
  ratingValue?: number | null;
  ratingCount?: number | null;
};

/**
 * Everything about this form that cannot be decided one field at a time.
 *
 * A plain function rather than a chain of .refine() calls, because it has TWO
 * callers that must never drift apart: restaurantSettingsSchema below, and the
 * PATCH route, which merges an incoming partial onto the STORED row and checks
 * the result.
 *
 * That second caller is why this exists at all. Settings is now saved section
 * by section, so a request can legitimately carry `upiQrEnabled: true` and
 * nothing else. Checked against the payload alone, every rule here passes
 * vacuously — a QR code with no UPI ID behind it, a restaurant with every order
 * type switched off, a rating with no review count. Each of those fails at the
 * guest, long after the owner has been told the save succeeded.
 *
 * Returns the FIRST problem only, matching how both callers consume it: the
 * route reports issues[0] and the form highlights one field at a time.
 */
export function settingsInvariantIssue(
  v: SettingsInvariantInput,
): { path: string; message: string } | null {
  if (!(v.dineInEnabled || v.takeAwayEnabled || v.deliveryEnabled)) {
    return {
      path: "dineInEnabled",
      message: "Enable at least one order type, or customers can't order at all",
    };
  }

  if (!(v.onlinePaymentEnabled || v.counterPaymentEnabled || v.upiQrEnabled)) {
    return { path: "onlinePaymentEnabled", message: "Enable at least one payment mode" };
  }

  // A UPI QR with no VPA would render a code that opens an error screen in the
  // guest's app — worse than not offering it, because it fails after they have
  // committed to paying that way.
  if (v.upiQrEnabled && !(v.upiVpa != null && isValidVpa(v.upiVpa))) {
    return { path: "upiVpa", message: "Enter a valid UPI ID, like kitchen@okhdfcbank" };
  }

  // Checked only when one was entered. A malformed GSTIN on a tax invoice is
  // worse than none at all: it turns a plain invoice into a document that
  // claims a registration the restaurant can't back up.
  if (v.gstin != null && !isValidGstin(v.gstin)) {
    return { path: "gstin", message: "A GSTIN is 15 characters, like 27AAACR1234R1ZQ" };
  }

  if (
    v.prepTimeMinMins != null &&
    v.prepTimeMaxMins != null &&
    v.prepTimeMinMins > v.prepTimeMaxMins
  ) {
    return {
      path: "prepTimeMinMins",
      message: "The shortest prep time can't be longer than the longest",
    };
  }

  // A rating with no review count reads as invented, and a count with no
  // rating has nothing to qualify. Both or neither.
  if ((v.ratingValue == null) !== (v.ratingCount == null)) {
    return {
      path: "ratingValue",
      message: "Give both a rating and how many reviews it's based on, or leave both blank",
    };
  }

  return null;
}

/**
 * The whole form at once — what the client validates before sending.
 *
 * Defaults for upiQrEnabled/taxInclusive/cuisineTags live HERE, via
 * `.extend()`, rather than on restaurantSettingsBaseFields — this path always
 * receives every field (a brand-new restaurant, or a full-form resend), so
 * defaulting an omitted one is correct. restaurantSettingsPatchSchema below
 * must never inherit these defaults; see restaurantSettingsBaseFields' own
 * comment for why.
 */
export const restaurantSettingsSchema = restaurantSettingsBaseFields
  .extend({
    upiQrEnabled: z.boolean().default(false),
    taxInclusive: z.coerce.boolean().default(false),
    cuisineTags: z.array(z.string().trim().min(1).max(24)).max(6).default([]),
  })
  .superRefine((v, ctx) => {
    const issue = settingsInvariantIssue(v);
    if (!issue) return;
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue.message, path: [issue.path] });
  });

/**
 * One settings section's worth of fields.
 *
 * Shape only — it deliberately runs NO cross-field rules, because a partial
 * payload does not carry enough to judge them. The route merges this onto the
 * stored row and calls settingsInvariantIssue() on the result; skipping that
 * step is how every invariant above quietly stops being enforced.
 *
 * Built off restaurantSettingsBaseFields, NOT restaurantSettingsSchema — the
 * base has no `.default(...)` anywhere, so `.partial()` here means an omitted
 * key genuinely parses as `undefined`, which is what the PATCH route's merge
 * logic (`"key" in rest`, `rest.key ?? before.key`) requires to work at all.
 */
export const restaurantSettingsPatchSchema = restaurantSettingsBaseFields.partial();

// ─── Restaurant: menu ──────────────────────────────────────────────────────

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/**
 * Rejects two rows with the same name (case-insensitive) within one item.
 * The database enforces this too via @@unique([menuItemId, name]), but
 * catching it here turns a 500 from a constraint violation into a message
 * that names the actual problem.
 */
function noDuplicateNames(items: { name: string }[]): boolean {
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/**
 * A variant adjusts the dish price rather than replacing it, so the delta may
 * be negative — a "Half plate" is priced below the base. Shared field shape
 * between the single-item form (which reconciles by `id`) and bulk import
 * (which has no `id` and matches by name instead).
 */
const variantFieldsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  priceDelta: z.coerce.number().int().min(-100000).max(100000).default(0),
  isDefault: z.boolean().default(false),
});

/// An optional extra — priced absolutely, not as a delta.
const addOnFieldsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  price: z.coerce.number().int().min(0).max(100000).default(0),
});

/**
 * `id` present means "this is an existing row, keep or edit it"; absent means
 * "create a new one". The item routes reconcile against this — see
 * app/api/restaurant/menu-items/[id]/route.ts.
 */
const menuItemVariantInputSchema = variantFieldsSchema.extend({ id: z.string().optional() });
const menuItemAddOnInputSchema = addOnFieldsSchema.extend({ id: z.string().optional() });

/**
 * Shape shared by create and update — deliberately no `.default(...)`
 * anywhere in this object. `.partial()` (in menuItemUpdateSchema below) does
 * not suppress `.default()` in zod 4, so a defaulted field here would come
 * back from a PATCH parse as its default value instead of genuinely absent —
 * exactly the bug restaurantSettingsBaseFields' comment above describes, and
 * the reason `variants`/`addOns` used to get silently wiped (reconciled to
 * `[]`) on every partial edit that didn't resend them. Defaults are applied
 * once, via `.extend()`, only on menuItemCreateSchema below — the path that
 * always receives every field.
 */
const menuItemBaseFields = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  price: z.coerce.number().int().min(0).max(1000000),
  isVeg: z.boolean(),
  isAvailable: z.boolean(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  imagePublicId: z.string().optional().or(z.literal("")),
  badge: z.preprocess(emptyToNull, z.enum(["BESTSELLER", "CHEFS_PICK", "POPULAR", "NEW"]).nullable()).optional(),
  ratingValue: optionalDisplayRating,
  // Capped at 240 to match the restaurant-level prep quote. Optional rather
  // than defaulted: "not quoted" must stay distinguishable from "quoted zero".
  prepMinutes: optionalInt(240),
  demoteAtPeak: z.boolean(),
  // Capped at 20: a dish with no size choice and no extras is the common
  // case, and 20 of either is already more than a printed menu shows.
  variants: z
    .array(menuItemVariantInputSchema)
    .max(20)
    .refine(noDuplicateNames, "Size names must be unique"),
  addOns: z
    .array(menuItemAddOnInputSchema)
    .max(20)
    .refine(noDuplicateNames, "Add-on names must be unique"),
});

export const menuItemCreateSchema = menuItemBaseFields.extend({
  isVeg: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  demoteAtPeak: z.boolean().default(false),
  variants: z
    .array(menuItemVariantInputSchema)
    .max(20)
    .refine(noDuplicateNames, "Size names must be unique")
    .default([]),
  addOns: z
    .array(menuItemAddOnInputSchema)
    .max(20)
    .refine(noDuplicateNames, "Add-on names must be unique")
    .default([]),
});

/**
 * Built off menuItemBaseFields, NOT menuItemCreateSchema.
 *
 * This used to derive from menuItemCreateSchema directly, on the belief that
 * `.partial()` makes variants/addOns optional rather than defaulted — that's
 * false in zod 4: `.partial()` does not suppress `.default()`, so an omitted
 * key still came back defaulted (`variants: []`) instead of genuinely absent.
 * Deriving from the undefaulted menuItemBaseFields instead is what actually
 * gets the distinction this route needs: omitted means "leave options
 * alone", an explicit `[]` means "remove every option this item has".
 */
export const menuItemUpdateSchema = menuItemBaseFields.partial().extend({
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

// ─── Restaurant: item options ──────────────────────────────────────────────

export const variantCreateSchema = variantFieldsSchema.extend({
  isAvailable: z.boolean().default(true),
});

/**
 * No current call site — kept in step with menuItemUpdateSchema's own
 * partial-PATCH shape regardless, so whoever wires this up next doesn't
 * inherit the landmine menuItemBaseFields' comment describes. Every field is
 * re-declared here rather than derived from variantFieldsSchema: `.extend()`
 * only overrides the keys it names, so inheriting priceDelta/isDefault from
 * variantFieldsSchema's own `.default(...)` would reintroduce the same bug
 * one level down — only isAvailable would actually get fixed.
 */
const variantBaseFields = z.object({
  name: z.string().trim().min(1).max(40),
  priceDelta: z.coerce.number().int().min(-100000).max(100000),
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
});
export const variantUpdateSchema = variantBaseFields.partial().extend({
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const addOnCreateSchema = addOnFieldsSchema.extend({
  isAvailable: z.boolean().default(true),
});

/** Same reasoning as variantBaseFields above — no current call site either. */
const addOnBaseFields = z.object({
  name: z.string().trim().min(1).max(40),
  price: z.coerce.number().int().min(0).max(100000),
  isAvailable: z.boolean(),
});
export const addOnUpdateSchema = addOnBaseFields.partial().extend({
  sortOrder: z.coerce.number().int().min(0).optional(),
});

// ─── Restaurant: bulk menu import ──────────────────────────────────────────
//
// Reuses variantFieldsSchema / addOnFieldsSchema from the item schema above —
// bulk-imported options carry no `id` (they're matched against existing rows
// by name instead, in the import route), which is exactly what those base
// shapes are before menuItemVariantInputSchema/menuItemAddOnInputSchema
// extend them with one.

const bulkItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  price: z.coerce.number().int().min(0).max(1000000),
  isVeg: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  badge: z
    .preprocess(emptyToNull, z.enum(["BESTSELLER", "CHEFS_PICK", "POPULAR", "NEW"]).nullable())
    .optional(),
  // Same fields as the single-item form. Omitting them is the common case and
  // leaves the dish untimed and never demoted, which is what a document
  // written before these existed should mean.
  prepMinutes: optionalInt(240),
  demoteAtPeak: z.boolean().default(false),
  // Optional and capped: a dish with no size choice and no extras is the
  // common case, and 20 of either is already more than a printed menu shows.
  variants: z
    .array(variantFieldsSchema)
    .max(20)
    .refine(noDuplicateNames, "Size names must be unique")
    .default([]),
  addOns: z
    .array(addOnFieldsSchema)
    .max(20)
    .refine(noDuplicateNames, "Add-on names must be unique")
    .default([]),
});

const bulkCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  items: z.array(bulkItemSchema).min(1).max(150),
});

export const menuBulkImportSchema = z.object({
  categories: z.array(bulkCategorySchema).min(1).max(50),
});

// ─── Restaurant: tables ────────────────────────────────────────────────────

export const tableCreateSchema = z.object({
  label: z.string().trim().min(1).max(40),
  seats: z.coerce.number().int().min(1).max(50).optional(),
});

export const tableUpdateSchema = tableCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const tableBulkCreateSchema = z.object({
  prefix: z.string().trim().min(1).max(20).default("Table"),
  count: z.coerce.number().int().min(1).max(50),
  startAt: z.coerce.number().int().min(1).max(500).default(1),
  seats: z.coerce.number().int().min(1).max(50).optional(),
});

// ─── Restaurant: orders ────────────────────────────────────────────────────

export const orderStatusUpdateSchema = z.object({
  status: z.enum(["ACCEPTED", "PREPARING", "READY", "PICKED_UP", "COMPLETED", "CANCELLED"]),
  cancelReason: z.string().trim().max(200).optional(),
});

// ─── Customer: ordering ────────────────────────────────────────────────────

export const customerLookupSchema = z.object({
  restaurantSlug: z.string().trim().min(1).max(60),
  mobile: mobileSchema,
});

export const customerAuthLoginSchema = z.object({
  restaurantSlug: z.string().trim().min(1).max(60),
  mobile: mobileSchema,
  name: z.string().trim().min(2).max(60).optional(),
});

export const trackOrderSchema = z.object({
  restaurantSlug: z.string().trim().min(1).max(60),
  mobile: mobileSchema,
});

export const placeOrderSchema = z
  .object({
    restaurantSlug: z.string().trim().min(1).max(60),
    tableCode: z.string().trim().min(1).max(40).optional(),
    customerName: z.string().trim().min(2).max(60),
    mobile: mobileSchema,
    type: z.enum(["DINE_IN", "TAKE_AWAY", "DELIVERY"]),
    // No paymentMode: the customer picks cash or UPI on the payment screen,
    // after the restaurant closes the invoice. See settleOrderSchema below.
    // Only ids and quantities: prices are always read from the database. The
    // option ids are no exception — they name a choice, they don't price it.
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(1),
          quantity: z.coerce.number().int().min(1).max(50),
          note: z.string().trim().max(120).optional(),
          variantId: z.string().min(1).optional(),
          addOnIds: z.array(z.string().min(1)).max(20).default([]),
        })
      )
      .min(1)
      .max(50),
    note: z.string().trim().max(300).optional(),
    deliveryAddress: z.string().trim().max(300).optional(),
    deliveryPincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter a valid 6-digit pincode")
      .optional(),
    deliveryNotes: z.string().trim().max(200).optional(),
    pickupInMinutes: z.coerce.number().int().min(0).max(180).optional(),
  })
  .refine((v) => v.type !== "DELIVERY" || (v.deliveryAddress && v.deliveryPincode), {
    message: "Delivery orders need an address and pincode",
    path: ["deliveryAddress"],
  })
  .refine((v) => v.type !== "DINE_IN" || !!v.tableCode, {
    message: "Dine-in orders must be placed from a table",
    path: ["tableCode"],
  });

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * What the customer chooses on the payment screen, once the restaurant has
 * closed the invoice. UPI routes through Razorpay Checkout (which offers UPI as
 * a method); CASH declares an intention to pay at the counter and waits for
 * the restaurant to confirm receipt.
 */
export const settleOrderSchema = z.object({
  // UPI routes through Razorpay Checkout. UPI_QR is the gateway-less path: a
  // deep-link QR the guest scans, confirmed by staff like cash — see
  // lib/restaurant/upi.ts for why it cannot confirm itself.
  method: z.enum(["UPI", "CASH", "UPI_QR"]),
});

// ─── Restaurant: opening hours ─────────────────────────────────────────────

export const hoursDaySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    // Minutes from midnight. 1439 is 23:59; a shift that ends at midnight is
    // expressed as 0, which the resolver reads as running past midnight.
    opensAt: z.coerce.number().int().min(0).max(1439),
    closesAt: z.coerce.number().int().min(0).max(1439),
    isClosed: z.coerce.boolean().default(false),
  })
  .refine((v) => v.isClosed || v.opensAt !== v.closesAt || v.opensAt === 0, {
    message: "Opening and closing time can't be the same",
    path: ["closesAt"],
  });

export const hoursUpdateSchema = z.object({
  timezone: z.string().trim().min(1).max(64).optional(),
  acceptingOrders: z.boolean().optional(),
  closedMessage: optionalText(120),
  // All seven days at once. A partial update would let a restaurant end up
  // with Tuesday missing, which the resolver reads as closed all day.
  days: z.array(hoursDaySchema).length(7).optional(),
});

// ─── Restaurant: peak hours ────────────────────────────────────────────────

/**
 * One rush window. Same minute-from-midnight units as hoursDaySchema, and the
 * same tolerance for an end earlier than the start — that means past midnight.
 *
 * A zero-length window is rejected rather than accepted-and-ignored: it is
 * always a half-filled form row, and silently dropping it would leave an owner
 * looking at a window that does nothing.
 */
export const peakWindowSchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startsAt: z.coerce.number().int().min(0).max(1439),
    endsAt: z.coerce.number().int().min(0).max(1439),
    label: optionalText(40),
  })
  .refine((v) => v.startsAt !== v.endsAt, {
    message: "A rush window needs a start and an end that differ",
    path: ["endsAt"],
  });

export const peakWindowsUpdateSchema = z.object({
  // The whole week at once. These rows have no natural key, so a partial
  // update has nothing to reconcile against — the route replaces the set.
  windows: z
    .array(peakWindowSchema)
    .max(7 * MAX_PEAK_WINDOWS_PER_DAY)
    .refine(
      (windows) =>
        windows.every(
          (window) =>
            windows.filter((other) => other.dayOfWeek === window.dayOfWeek).length <=
            MAX_PEAK_WINDOWS_PER_DAY
        ),
      { message: `A day can hold at most ${MAX_PEAK_WINDOWS_PER_DAY} rush windows` }
    ),
});

// ─── Restaurant: invoice sections ──────────────────────────────────────────

/** A6-ish paper has room for a handful of extra lines, not a second document. */
const MAX_INVOICE_SECTIONS = 6;

/**
 * One restaurant-authored block on the invoice — a title and a body, printed
 * below the totals and payment status. See RestoInvoiceSection in
 * schema.prisma for what this becomes on the printed page.
 */
export const invoiceSectionSchema = z.object({
  title: z.string().trim().min(1, "Give this section a title").max(40),
  body: z.string().trim().min(1, "This section needs some text").max(300),
  isActive: z.boolean().default(true),
});

export const invoiceSectionsUpdateSchema = z.object({
  // The whole list at once, same replace-the-set reasoning as peak windows —
  // these rows carry no natural key to reconcile against, and the owner's
  // on-screen order is what becomes sortOrder.
  sections: z.array(invoiceSectionSchema).max(MAX_INVOICE_SECTIONS, `At most ${MAX_INVOICE_SECTIONS} sections`),
});

// ─── Customer: reviews ─────────────────────────────────────────────────────

export const reviewCreateSchema = z.object({
  orderId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export type RestaurantCreateInput = z.infer<typeof restaurantCreateSchema>;
export type RestaurantSettingsInput = z.infer<typeof restaurantSettingsSchema>;
export type MenuItemCreateInput = z.infer<typeof menuItemCreateSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type HoursUpdateInput = z.infer<typeof hoursUpdateSchema>;
export type MenuBulkImportInput = z.infer<typeof menuBulkImportSchema>;

/**
 * Hand-written replacements for the `@prisma/client` type-only imports that
 * used to leak into client and server components across the restaurant
 * module. This app has no Prisma client — these are string-literal unions
 * mirroring the Prisma schema's Resto* enums 1:1 (priinteve-api's
 * prisma/schema.prisma), kept in sync by hand since there is no shared
 * package with the API.
 */

export type RestoUserRole = "OWNER" | "STAFF";

export type RestoOrderType = "DINE_IN" | "TAKE_AWAY" | "DELIVERY";

export type RestoOrderStatus =
  | "PLACED"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "PICKED_UP"
  | "COMPLETED"
  | "CANCELLED";

/**
 * ONLINE settles itself — Razorpay verifies the signature and a webhook
 * confirms it. COUNTER and UPI_QR both wait for a staff member to say the
 * money arrived, because neither cash nor a UPI deep link tells us on its
 * own. UPI_QR is kept apart from COUNTER rather than folded into it so the
 * till report can tell notes from a bank credit.
 */
export type RestoPaymentMode = "ONLINE" | "COUNTER" | "UPI_QR";

/**
 * PENDING is "the meal is not over yet" — no one is expected to pay.
 * REQUESTED means the restaurant has closed the invoice and the customer's
 * payment screen has opened. Nothing charges a customer before REQUESTED.
 */
export type RestoPaymentStatus = "PENDING" | "REQUESTED" | "PAID" | "FAILED" | "REFUNDED";

/** Owner-set highlight on a dish. Presentation only. */
export type RestoItemBadge = "BESTSELLER" | "CHEFS_PICK" | "POPULAR" | "NEW";

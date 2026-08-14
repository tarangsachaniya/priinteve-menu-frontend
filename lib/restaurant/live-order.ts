import type {
  RestoOrderStatus,
  RestoOrderType,
  RestoPaymentMode,
  RestoPaymentStatus,
} from "@/lib/api/enums";

/**
 * One live order exactly as GET /api/restaurant/orders returns it.
 *
 * Declared once because three screens now read the same payload — the orders
 * board, the kitchen display, and the server components that seed both. Three
 * hand-maintained copies of a DTO drift, and the way they drift is that someone
 * adds a field to the API and only two of them learn about it.
 */

export type LiveOrderItem = {
  id: string;
  name: string;
  quantity: number;
  lineTotal: number;
  variantName: string | null;
  /** Per-line instruction from the guest: "no onion", "extra spicy". */
  note: string | null;
  /** Serve time quoted for this dish when it was ordered. */
  prepMinutes: number | null;
  addOns: string[];
};

/**
 * The subset a kitchen ticket actually renders.
 *
 * Narrower than LiveOrder on purpose. The mounted kitchen screen authenticates
 * with a link and a PIN rather than a staff login, so GET /api/screen/:token/orders
 * deliberately withholds totals, payment state and the customer's phone number.
 * Typing the display against what it needs — instead of against the console's
 * fuller payload — is what lets one component serve both without either endpoint
 * having to pretend it returns fields it does not.
 *
 * LiveOrder satisfies this structurally, so the staff route at /r/kitchen passes
 * its own payload straight in.
 */
export type KitchenOrderItem = {
  id: string;
  name: string;
  quantity: number;
  variantName: string | null;
  note: string | null;
  addOns: string[];
};

export type KitchenOrder = {
  id: string;
  orderNumber: number;
  status: RestoOrderStatus;
  type: RestoOrderType;
  tableLabel: string | null;
  note: string | null;
  placedAt: string;
  items: KitchenOrderItem[];
};

/** Where the console reads and writes orders. Screens use /api/screen/<token>/orders. */
export const CONSOLE_ORDERS_PATH = "/api/restaurant/orders";

export type LiveOrder = {
  id: string;
  orderNumber: number;
  status: RestoOrderStatus;
  type: RestoOrderType;
  /** Null until the customer picks a method on the payment screen. */
  paymentMode: RestoPaymentMode | null;
  paymentStatus: RestoPaymentStatus;
  customerName: string;
  customerMobile: string;
  tableLabel: string | null;
  total: number;
  note: string | null;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  pickupInMinutes: number | null;
  placedAt: string;
  items: LiveOrderItem[];
};

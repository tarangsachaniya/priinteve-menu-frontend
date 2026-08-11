/**
 * UPI deep links, for restaurants with no payment gateway.
 *
 * The format is NPCI's UPI Deep Link spec — `upi://pay?pa=…&pn=…&am=…&cu=INR`
 * — and every UPI app on the guest's phone understands it. Encoded as a QR it
 * opens their app with the payee and the amount already filled in.
 *
 * Three things this cannot do, all of which shape how it is used:
 *
 *   1. It cannot confirm a payment. There is no callback and no webhook; the
 *      link is one-way. Nothing in this module ever marks an order paid — a
 *      staff member does, from the orders board, exactly as they do for cash.
 *      That is why UPI_QR settles like COUNTER and not like ONLINE.
 *   2. It cannot lock the amount. On a personal (P2P) VPA most apps let the
 *      payer edit `am` before confirming. Only a merchant QR signed through a
 *      PSP fixes it, which needs `sign`/`mode`/`orgid` and a PSP relationship.
 *      Pre-filling is a convenience; the staff check is what makes it safe.
 *   3. It cannot raise the P2P limit. A personal VPA taking restaurant volume
 *      runs into UPI's daily cap and reads to a bank as an individual. The
 *      settings screen says so.
 *
 * `tr` is what makes the whole thing reconcilable in practice: it travels into
 * the restaurant's bank statement and payment SMS, so a credit can be matched
 * back to an order number without guessing from the amount.
 */

/**
 * `<user>@<handle>` — the shape every VPA takes.
 *
 * Deliberately loose on the local part, which banks and PSPs define
 * differently and keep extending; strict only about the structure, since that
 * is all that decides whether a UPI app can route it. A typo that still parses
 * is caught by the guest's app saying the payee doesn't exist, which is a
 * better error than anything guessed here.
 */
const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z][a-zA-Z0-9.\-_]{1,63}$/;

export function isValidVpa(value: string): boolean {
  return VPA_PATTERN.test(value.trim());
}

/** The spec caps the transaction reference at 35 characters. */
const MAX_TRANSACTION_REF = 35;

/**
 * A reference that survives the round trip into a bank statement.
 *
 * Alphanumeric only: separators are stripped by some banks and mangled by
 * others, and a reference that arrives altered is worse than a short one.
 */
export function buildTransactionRef({
  orderNumber,
  orderId,
}: {
  orderNumber: number;
  orderId: string;
}): string {
  const suffix = orderId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  return `ORD${orderNumber}${suffix}`.slice(0, MAX_TRANSACTION_REF);
}

export type UpiLinkInput = {
  vpa: string;
  payeeName: string;
  /** Whole rupees, as stored everywhere in this module. */
  amount: number;
  /** Free text shown in the guest's app, e.g. "Order #42 · Rasoi". */
  note?: string;
  transactionRef?: string;
};

/**
 * The `upi://pay?…` link.
 *
 * Every value goes through encodeURIComponent. A payee name carrying a space
 * or an ampersand — "Bombay Grill & Bar" is an ordinary restaurant name —
 * would otherwise truncate the link at that character, and the guest's app
 * would open showing a payee called "Bombay Grill".
 *
 * The amount is written with two decimals because the spec asks for it, even
 * though every amount in this module is a whole rupee.
 */
export function buildUpiUri({
  vpa,
  payeeName,
  amount,
  note,
  transactionRef,
}: UpiLinkInput): string {
  const params = new URLSearchParams();
  params.set("pa", vpa.trim());
  params.set("pn", payeeName.trim());
  params.set("am", amount.toFixed(2));
  params.set("cu", "INR");
  if (note) params.set("tn", note.slice(0, 50));
  if (transactionRef) params.set("tr", transactionRef);

  // URLSearchParams encodes a space as "+", which is correct for a form body
  // and wrong in a URI query a UPI app parses — several read it literally and
  // show "Bombay+Grill" as the payee.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/** "Order #42 · Rasoi" — what the guest sees as the payment note. */
export function buildPaymentNote({
  orderNumber,
  restaurantName,
}: {
  orderNumber: number;
  restaurantName: string;
}): string {
  return `Order #${orderNumber} · ${restaurantName}`.slice(0, 50);
}

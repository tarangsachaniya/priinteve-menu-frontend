/**
 * GST identifiers and the tax split a restaurant invoice has to show.
 *
 * Pure functions, no database and no PDF: the same maths decides what the
 * invoice prints and could later decide what a return export contains, and
 * those two must never disagree.
 */

/**
 * A GSTIN is 15 characters: 2-digit state code, 10-character PAN, 1-digit
 * entity number, a fixed "Z", and a checksum character.
 *
 * The structure is validated; the checksum is not. A wrong-but-well-formed
 * GSTIN is the registrar's problem to catch, and rejecting a real one because
 * of a checksum implementation bug would stop an owner billing at all.
 */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(value: string): string {
  return value.replace(/\s/g, "").toUpperCase();
}

export function isValidGstin(value: string): boolean {
  return GSTIN_PATTERN.test(normalizeGstin(value));
}

/** State codes as they appear in the first two digits of every GSTIN. */
const GST_STATE_NAMES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

/**
 * "Maharashtra (27)" from a GSTIN, or null when it can't be read.
 *
 * Derived rather than stored: the state on a tax invoice must be the state the
 * registration belongs to, and asking an owner to type it separately creates a
 * second answer that can contradict the first.
 */
export function describeGstinState(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const code = normalizeGstin(gstin).slice(0, 2);
  const name = GST_STATE_NAMES[code];
  return name ? `${name} (${code})` : null;
}

export type TaxSplit = {
  /** Half the tax, as central GST. */
  cgst: number;
  /** The other half, as state GST. */
  sgst: number;
  /** The rate each half is charged at, e.g. 2.5 for a 5% total. */
  halfRatePercent: number;
};

/**
 * The CGST/SGST split an Indian restaurant invoice shows.
 *
 * Always an intra-state supply, so always split in half rather than charged as
 * IGST: a guest eats where the restaurant is. Split at PAISA precision, not
 * whole-rupee precision — taxAmount is routinely fractional (₹150 @ 5% is
 * ₹7.50, see pricing.ts), and rounding it up to a whole rupee before halving
 * would overcharge CGST by up to 50 paise. The rounding puts any odd paisa on
 * CGST so the two halves still add back to exactly the tax that was charged
 * — an invoice whose parts don't sum to its total is one an auditor stops at.
 */
export function splitTax(taxAmount: number, taxPercent: number): TaxSplit {
  const paisa = Math.round(taxAmount * 100);
  const cgstPaisa = Math.ceil(paisa / 2);
  return {
    cgst: cgstPaisa / 100,
    sgst: (paisa - cgstPaisa) / 100,
    halfRatePercent: taxPercent / 2,
  };
}

/**
 * The pre-tax base a bill's "Subtotal" line shows.
 *
 * Exclusive mode: `subtotal` already IS that base — taxAmount was added on
 * top of it, never folded in, so it passes through unchanged.
 *
 * Inclusive mode: `subtotal` is the gross, GST-included menu total (what the
 * items actually cost), so the base a bill has to show as "Subtotal" is what
 * remains once the GST already folded into it is taken back out — otherwise
 * a printed Subtotal + CGST + SGST would overshoot the printed Total by the
 * tax amount, double-counting it.
 *
 * MUST stay identical to priinteve-api's copy of this file — see
 * pricing.ts's PricingRules.taxInclusive comment for why the two copies can
 * never disagree.
 */
export function taxableAmount({
  subtotal,
  taxAmount,
  taxInclusive,
}: {
  subtotal: number;
  taxAmount: number;
  taxInclusive: boolean;
}): number {
  return taxInclusive ? subtotal - taxAmount : subtotal;
}

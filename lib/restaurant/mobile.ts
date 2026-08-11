/**
 * Indian mobile numbers for the restaurant ordering module.
 *
 * Stored canonically as +91XXXXXXXXXX so that the same person typing
 * "98765 43210", "+919876543210" or "09876543210" always resolves to the one
 * RestoCustomer row — which is what makes name prefill work.
 */

/** A valid Indian mobile: ten digits starting 6, 7, 8 or 9. */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

/** Strips everything that isn't a digit, then drops a +91 / 91 / 0 prefix. */
export function extractNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidIndianMobile(input: string): boolean {
  return INDIAN_MOBILE_REGEX.test(extractNationalDigits(input));
}

/**
 * Canonical storage form: "+919876543210".
 * Returns null when the input isn't a valid Indian mobile, so callers are
 * forced to handle the invalid case rather than storing junk.
 */
export function normalizeMobile(input: string): string | null {
  const national = extractNationalDigits(input);
  return INDIAN_MOBILE_REGEX.test(national) ? `+91${national}` : null;
}

/** Display form: "+91 98765 43210". */
export function formatMobile(stored: string): string {
  const national = extractNationalDigits(stored);
  if (!INDIAN_MOBILE_REGEX.test(national)) return stored;
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

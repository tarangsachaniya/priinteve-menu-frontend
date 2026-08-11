export type DisplayCurrency = { code: string; rate: number };

const CURRENCY_LOCALE: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  GBP: "en-GB",
  EUR: "de-DE",
};

export function formatLocalPrice(amountInr: number, currency: DisplayCurrency): string {
  const converted = Math.round(amountInr * currency.rate);
  const locale = CURRENCY_LOCALE[currency.code] ?? "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.code,
    maximumFractionDigits: 0,
  }).format(converted);
}

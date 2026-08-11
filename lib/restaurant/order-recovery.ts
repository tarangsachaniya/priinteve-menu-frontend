/**
 * Remembers the last order a guest placed at a given restaurant, so that
 * refreshing the menu or re-scanning the table QR code doesn't lose the link
 * back to its status page. Mirrors the storage pattern in
 * components/order/resto-mode-toggle.tsx and the key-naming convention of
 * restoModeStorageKey() in lib/restaurant/theme.ts.
 */

export type ResumeOrder = {
  orderId: string;
  orderNumber: number;
  statusUrl: string;
  placedAt: string; // ISO
};

export function resumeOrderStorageKey(slug: string): string {
  return `printeve-resto-order:${slug}`;
}

export function writeResumeOrder(slug: string, order: ResumeOrder): void {
  try {
    localStorage.setItem(resumeOrderStorageKey(slug), JSON.stringify(order));
  } catch {
    // Private mode / disabled storage: recovery is a nicety, not a requirement.
  }
}

export function readResumeOrder(slug: string): ResumeOrder | null {
  try {
    const raw = localStorage.getItem(resumeOrderStorageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.orderId !== "string" ||
      typeof parsed?.orderNumber !== "number" ||
      typeof parsed?.statusUrl !== "string" ||
      typeof parsed?.placedAt !== "string"
    ) {
      return null;
    }
    return parsed as ResumeOrder;
  } catch {
    return null;
  }
}

export function clearResumeOrder(slug: string): void {
  try {
    localStorage.removeItem(resumeOrderStorageKey(slug));
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}

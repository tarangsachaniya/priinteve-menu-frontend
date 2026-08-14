/**
 * Client-safe URL builders for the mounted screens.
 *
 * SEPARATE FROM screen.ts ON PURPOSE, and not merely for tidiness: screen.ts
 * reaches serverFetch, which imports next/headers, which cannot be pulled into a
 * client bundle. The kitchen screen and the pickup board are both client
 * components that need these paths to poll, so a single module holding both the
 * fetchers and the string builders fails the production build — while passing
 * tsc, which does not know the difference.
 *
 * Nothing in this file may import anything that touches the request.
 */

export function screenOrdersPath(token: string): string {
  return `/api/screen/${encodeURIComponent(token)}/orders`;
}

export function screenPickupPath(token: string): string {
  return `/api/screen/${encodeURIComponent(token)}/pickup`;
}

export function screenLockPath(token: string): string {
  return `/api/screen/${encodeURIComponent(token)}/lock`;
}

export function screenUnlockPath(token: string): string {
  return `/api/screen/${encodeURIComponent(token)}/unlock`;
}

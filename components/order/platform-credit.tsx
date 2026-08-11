/**
 * Platform credit at the foot of every customer-facing restaurant page.
 *
 * Deliberately the last thing on the page, after everything the restaurant
 * put there — a guest is here for the restaurant, not the platform, so this
 * stays out of the way until they've scrolled past all of it. Muted on
 * purpose: it must never compete with the restaurant's own brand colour for
 * attention on their own menu.
 */
export function PlatformCredit() {
  return (
    <p
      className="py-6 text-center text-xs"
      style={{ color: "var(--resto-text-subtle)" }}
    >
      Powered by{" "}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline-offset-2 hover:underline"
        style={{ color: "var(--resto-text-muted)" }}
      >
        Priinteve Innovations
      </a>
    </p>
  );
}

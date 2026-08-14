"use client";

import { useRouter } from "next/navigation";

import { ScreenLock } from "@/components/restaurant/screen-lock";

/**
 * Wraps the keypad so unlocking re-runs the page on the server.
 *
 * The unlock endpoint's whole effect is a Set-Cookie, relayed to the browser
 * through the Next proxy. router.refresh() then re-renders the server component
 * with that cookie attached, which is what turns the keypad into the screen —
 * no client-side state has to mirror "am I unlocked", and a reload lands in
 * exactly the same place.
 */
export function ScreenGate({
  token,
  title,
  subtitle,
}: {
  token: string;
  title: string;
  subtitle: string;
}) {
  const router = useRouter();

  return (
    <ScreenLock
      token={token}
      title={title}
      subtitle={subtitle}
      onUnlocked={() => router.refresh()}
    />
  );
}

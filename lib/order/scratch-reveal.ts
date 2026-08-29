export type ScratchReward = {
  type: string;
  label: string;
  percentValue: number | null;
  amountValue: number | null;
} | null;

export type ScratchCardEntry = {
  id: string;
  status: string;
  reward: ScratchReward;
};

/**
 * Shared by every surface that reveals a scratch card (My Rewards, the
 * bill-paid prompt) so a fix to error handling here can't drift between
 * copies. Throws on failure — the backend reveal endpoint is idempotent, so
 * callers can safely retry after a failed attempt.
 */
export async function revealScratchCard(
  cardId: string,
  restaurantSlug: string,
): Promise<{ card: ScratchCardEntry; pointsBalanceAfter?: number }> {
  const res = await fetch(`/api/order/scratch/${cardId}/scratch?restaurantSlug=${restaurantSlug}`, {
    method: "POST",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.card) {
    throw new Error(typeof data?.error === "string" ? data.error : "Could not reveal this card");
  }
  return {
    card: data.card,
    pointsBalanceAfter: typeof data.pointsBalanceAfter === "number" ? data.pointsBalanceAfter : undefined,
  };
}

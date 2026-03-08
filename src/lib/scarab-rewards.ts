/**
 * Unified Scarab Reward System
 *
 * Credits Scarab to any wallet address (user or agent).
 * Both use the same ScarabBalance table — one ledger for everyone.
 *
 * Reward actions:
 *   - outcome_report: +10 Scarab (reported outcome for a query)
 *   - daily_claim:    +5 + streak
 *   - first_claim:    +20
 *   - review_submit:  -5
 */

import { prisma } from "@/lib/prisma";

const OUTCOME_REWARD = 5;

/**
 * Credit Scarab reward for reporting an outcome.
 * Creates ScarabBalance if it doesn't exist.
 */
export async function rewardOutcome(walletAddress: string): Promise<{ balance: number; earned: number }> {
  const normalized = walletAddress.toLowerCase();

  const result = await prisma.$transaction(async (tx) => {
    // Upsert balance
    const bal = await tx.scarabBalance.upsert({
      where: { address: normalized },
      create: {
        address: normalized,
        balance: OUTCOME_REWARD,
        totalEarned: OUTCOME_REWARD,
      },
      update: {
        balance: { increment: OUTCOME_REWARD },
        totalEarned: { increment: OUTCOME_REWARD },
      },
    });

    // Record transaction
    await tx.scarabTransaction.create({
      data: {
        address: normalized,
        amount: OUTCOME_REWARD,
        type: "outcome_reward",
        description: "Reward for reporting outcome feedback",
        balanceAfter: bal.balance,
      },
    });

    return { balance: bal.balance, earned: OUTCOME_REWARD };
  });

  return result;
}

/**
 * Get Scarab balance for any wallet address.
 */
export async function getScarabBalance(walletAddress: string): Promise<number> {
  const normalized = walletAddress.toLowerCase();
  const bal = await prisma.scarabBalance.findUnique({
    where: { address: normalized },
  });
  return bal?.balance ?? 0;
}

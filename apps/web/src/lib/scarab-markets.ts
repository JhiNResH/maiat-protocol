/**
 * Scarab Markets Extension
 *
 * Additional Scarab operations for Opinion Markets feature.
 * Extends the base scarab.ts with market-specific operations.
 */

import { prisma } from './prisma'

/**
 * Spend arbitrary Scarab amount for market operations
 */
export async function spendScarabAmount(
  address: string,
  amount: number,
  type: string,
  referenceId?: string,
) {
  const normalized = address.toLowerCase()

  return prisma.$transaction(async (tx) => {
    const bal = await tx.scarabBalance.findUnique({
      where: { address: normalized },
    })

    if (!bal || bal.balance < amount) {
      throw new Error(`Insufficient Scarab. Need ${amount}, have ${bal?.balance ?? 0}`)
    }

    const newBalance = bal.balance - amount

    await tx.scarabBalance.update({
      where: { address: normalized },
      data: {
        balance: newBalance,
        totalSpent: bal.totalSpent + amount,
      },
    })

    await tx.scarabTransaction.create({
      data: {
        address: normalized,
        amount: -amount,
        type,
        description: `Market stake: ${amount} Scarab 🪲`,
        referenceId,
        balanceAfter: newBalance,
      },
    })

    return { spent: amount, balance: newBalance }
  })
}

/**
 * Award Scarab to a user (for market winnings)
 */
export async function awardScarab(
  address: string,
  amount: number,
  description: string,
  referenceId?: string,
) {
  const normalized = address.toLowerCase()

  return prisma.$transaction(async (tx) => {
    const bal = await tx.scarabBalance.upsert({
      where: { address: normalized },
      create: { address: normalized, balance: amount, totalEarned: amount },
      update: {},
    })

    const newBalance = bal.balance + amount

    await tx.scarabBalance.update({
      where: { address: normalized },
      data: {
        balance: newBalance,
        totalEarned: bal.totalEarned + amount,
      },
    })

    await tx.scarabTransaction.create({
      data: {
        address: normalized,
        amount,
        type: 'market_payout',
        description,
        referenceId,
        balanceAfter: newBalance,
      },
    })

    return { awarded: amount, balance: newBalance }
  })
}

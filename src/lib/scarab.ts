/**
 * Scarab Economy Service
 * 
 * Off-chain points system for Maat Phase 1 MVP.
 * 
 * Economics:
 * - Initial claim: 20 Scarab (one-time)
 * - Daily claim: +5 Scarab (streak bonus: +1 per consecutive day, max +10)
 * - Review cost: -2 Scarab
 * - Vote cost: -5 Scarab
 * - Purchase: $1=50 | $5=300 | $20=1500
 * - First-week 2x boost (configurable)
 */

import { prisma } from './prisma'

// ============================================
// Constants
// ============================================

export const SCARAB_CONFIG = {
  INITIAL_CLAIM: 20,
  DAILY_CLAIM: 5,
  STREAK_BONUS: 1, // +1 per consecutive day
  MAX_STREAK_BONUS: 5, // cap at +5 extra
  REVIEW_COST: 2,
  VOTE_COST: 5,
  BOOST_MULTIPLIER: 2, // first-week boost
  PURCHASE_TIERS: {
    small: { usdc: 1, scarab: 50 },
    medium: { usdc: 5, scarab: 300 },
    large: { usdc: 20, scarab: 1500 },
  },
} as const

// ============================================
// Balance Operations
// ============================================

export async function getOrCreateBalance(address: string) {
  const normalized = address.toLowerCase()
  return prisma.scarabBalance.upsert({
    where: { address: normalized },
    create: { address: normalized, balance: 0, totalEarned: 0, totalSpent: 0, totalPurchased: 0 },
    update: {},
  })
}

export async function getBalance(address: string) {
  const normalized = address.toLowerCase()
  const balance = await prisma.scarabBalance.findUnique({
    where: { address: normalized },
  })
  return balance ?? { address: normalized, balance: 0, totalEarned: 0, totalSpent: 0, totalPurchased: 0, lastClaimAt: null, streak: 0 }
}

// ============================================
// Daily Claim
// ============================================

function isSameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
}

function isConsecutiveDay(last: Date, now: Date): boolean {
  const diff = now.getTime() - last.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  // Between 12h and 48h counts as consecutive (generous window)
  return diff >= 12 * 60 * 60 * 1000 && diff < 48 * 60 * 60 * 1000
}

export async function claimDaily(address: string, boost: boolean = false) {
  const normalized = address.toLowerCase()
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const bal = await tx.scarabBalance.upsert({
      where: { address: normalized },
      create: { address: normalized, balance: 0 },
      update: {},
    })

    // First ever claim → give initial bonus
    const isFirstClaim = !bal.lastClaimAt
    
    // Check if already claimed today
    if (bal.lastClaimAt && isSameDay(bal.lastClaimAt, now)) {
      throw new Error('Already claimed today')
    }

    // Calculate streak
    let newStreak = 1
    if (bal.lastClaimAt && isConsecutiveDay(bal.lastClaimAt, now)) {
      newStreak = bal.streak + 1
    }

    // Calculate amount
    let amount = isFirstClaim ? SCARAB_CONFIG.INITIAL_CLAIM : SCARAB_CONFIG.DAILY_CLAIM
    const streakBonus = Math.min(
      (newStreak - 1) * SCARAB_CONFIG.STREAK_BONUS,
      SCARAB_CONFIG.MAX_STREAK_BONUS
    )
    amount += streakBonus
    if (boost) amount *= SCARAB_CONFIG.BOOST_MULTIPLIER

    const newBalance = bal.balance + amount

    // Update balance
    await tx.scarabBalance.update({
      where: { address: normalized },
      data: {
        balance: newBalance,
        totalEarned: bal.totalEarned + amount,
        lastClaimAt: now,
        streak: newStreak,
      },
    })

    // Record transaction
    await tx.scarabTransaction.create({
      data: {
        address: normalized,
        amount,
        type: isFirstClaim ? 'claim' : 'claim',
        description: isFirstClaim
          ? `Welcome bonus: ${amount} Scarab 🪲`
          : `Daily claim: ${SCARAB_CONFIG.DAILY_CLAIM}${streakBonus > 0 ? ` + ${streakBonus} streak bonus` : ''}${boost ? ' (2x boost!)' : ''} 🪲`,
        balanceAfter: newBalance,
      },
    })

    return {
      amount,
      balance: newBalance,
      streak: newStreak,
      isFirstClaim,
      streakBonus,
      boosted: boost,
    }
  })
}

// ============================================
// Spend Scarab
// ============================================

export type SpendType = 'review_spend' | 'vote_spend'

export async function spendScarab(
  address: string,
  type: SpendType,
  referenceId?: string,
) {
  const normalized = address.toLowerCase()
  const cost = type === 'review_spend' ? SCARAB_CONFIG.REVIEW_COST : SCARAB_CONFIG.VOTE_COST

  return prisma.$transaction(async (tx) => {
    const bal = await tx.scarabBalance.findUnique({
      where: { address: normalized },
    })

    if (!bal || bal.balance < cost) {
      throw new Error(`Insufficient Scarab. Need ${cost}, have ${bal?.balance ?? 0}`)
    }

    const newBalance = bal.balance - cost

    await tx.scarabBalance.update({
      where: { address: normalized },
      data: {
        balance: newBalance,
        totalSpent: bal.totalSpent + cost,
      },
    })

    await tx.scarabTransaction.create({
      data: {
        address: normalized,
        amount: -cost,
        type,
        description: type === 'review_spend' ? 'Review submitted (-2 🪲)' : 'Weekly vote cast (-5 🪲)',
        referenceId,
        balanceAfter: newBalance,
      },
    })

    return { cost, balance: newBalance }
  })
}

// ============================================
// Purchase Scarab with USDC
// ============================================

export async function createPurchase(
  address: string,
  tier: 'small' | 'medium' | 'large',
) {
  const normalized = address.toLowerCase()
  const tierConfig = SCARAB_CONFIG.PURCHASE_TIERS[tier]

  const purchase = await prisma.scarabPurchase.create({
    data: {
      address: normalized,
      tier,
      usdcAmount: tierConfig.usdc,
      scarabAmount: tierConfig.scarab,
      status: 'pending',
    },
  })

  return purchase
}

export async function confirmPurchase(purchaseId: string, txHash: string) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.scarabPurchase.findUnique({
      where: { id: purchaseId },
    })

    if (!purchase) throw new Error('Purchase not found')
    if (purchase.status !== 'pending') throw new Error(`Purchase already ${purchase.status}`)

    // Update purchase status
    await tx.scarabPurchase.update({
      where: { id: purchaseId },
      data: { status: 'confirmed', txHash, confirmedAt: new Date() },
    })

    // Credit Scarab
    const bal = await tx.scarabBalance.upsert({
      where: { address: purchase.address },
      create: { address: purchase.address, balance: purchase.scarabAmount, totalPurchased: purchase.scarabAmount, totalEarned: purchase.scarabAmount },
      update: {},
    })

    const newBalance = bal.balance + purchase.scarabAmount

    await tx.scarabBalance.update({
      where: { address: purchase.address },
      data: {
        balance: newBalance,
        totalPurchased: bal.totalPurchased + purchase.scarabAmount,
        totalEarned: bal.totalEarned + purchase.scarabAmount,
      },
    })

    await tx.scarabTransaction.create({
      data: {
        address: purchase.address,
        amount: purchase.scarabAmount,
        type: 'purchase',
        description: `Purchased ${purchase.scarabAmount} Scarab ($${purchase.usdcAmount} USDC) 🪲`,
        referenceId: purchaseId,
        balanceAfter: newBalance,
      },
    })

    return { balance: newBalance, scarabAmount: purchase.scarabAmount }
  })
}

// ============================================
// Reward Scarab (for resolved predictions, etc.)
// ============================================

export async function rewardScarab(
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
        type: 'reward',
        description,
        referenceId,
        balanceAfter: newBalance,
      },
    })

    return { amount, balance: newBalance }
  })
}

// ============================================
// Transaction History
// ============================================

export async function getTransactionHistory(
  address: string,
  limit: number = 20,
  offset: number = 0,
) {
  const normalized = address.toLowerCase()
  const [transactions, total] = await Promise.all([
    prisma.scarabTransaction.findMany({
      where: { address: normalized },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.scarabTransaction.count({
      where: { address: normalized },
    }),
  ])

  return { transactions, total, limit, offset }
}

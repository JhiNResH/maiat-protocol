/**
 * Shared scoring constants for the Maiat trust system.
 * Single source of truth for weights, thresholds, and staleness.
 */

/** 3-layer trust weights (must sum to 1.0) */
export const TRUST_WEIGHTS = {
  ON_CHAIN: 0.5,
  OFF_CHAIN: 0.3,
  HUMAN_REVIEWS: 0.2,
} as const

/**
 * Wadjet Price Health Modifiers (applied to ACP base score)
 * 
 * Price data from DexScreener (indexed every 15 min by Wadjet/maiat-indexer)
 * feeds into trust scoring as a modifier on the ACP behavioral base score.
 * 
 * Formula: finalScore = clamp(acpBaseScore + priceModifier, 0, 100)
 * 
 * | Condition                       | Modifier |
 * | ------------------------------- | -------- |
 * | 24h change ≤ -50%               | -15      |
 * | 24h change ≤ -30%               | -10      |
 * | 24h change ≤ -15%               | -5       |
 * | Stable (≥0%) + liquidity ≥$50k  | +10      |
 * | Stable (≥-5%) + liq ≥$10k      | +5       |
 * | Liquidity < $1k (manipulable)   | max -5   |
 * | No token / no price data        | 0 (neutral) |
 */
export const PRICE_HEALTH = {
  CRASH_SEVERE: -15,   // ≤ -50%
  CRASH_MAJOR: -10,    // ≤ -30%
  CRASH_MINOR: -5,     // ≤ -15%
  STABLE_HIGH_LIQ: 10, // ≥ 0% change + $50k+ liquidity
  STABLE_MED_LIQ: 5,   // ≥ -5% change + $10k+ liquidity
  LOW_LIQ_PENALTY: -5,  // < $1k liquidity
} as const

/** Score is considered stale after this many hours */
export const STALE_THRESHOLD_HOURS = 24

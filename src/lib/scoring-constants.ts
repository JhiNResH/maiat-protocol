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

/** Score is considered stale after this many hours */
export const STALE_THRESHOLD_HOURS = 24

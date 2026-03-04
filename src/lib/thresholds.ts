/**
 * Trust Score Thresholds
 *
 * Aligns with CRE workflow tier definition and TrustScoreOracle (0–100 scale).
 *
 * Tier  | Score (0–100) | On-chain (0–10) | Label
 * -------|--------------|-----------------|---------
 * Gold   | ≥ 70         | ≥ 7.0           | LOW RISK
 * Amber  | ≥ 40         | ≥ 4.0           | MEDIUM RISK
 * Red    | < 40         | < 4.0           | HIGH RISK / CRITICAL RISK
 */

export const TRUST_SCORE = {
  /** 0-100 score thresholds (matches TrustScoreOracle) */
  GOLD: 70,    // LOW RISK
  AMBER: 40,   // MEDIUM RISK
  CRITICAL: 10, // CRITICAL vs HIGH boundary

  /** Tier labels */
  label(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return 'LOW RISK';
    if (score >= TRUST_SCORE.AMBER) return 'MEDIUM RISK';
    if (score >= TRUST_SCORE.CRITICAL) return 'HIGH RISK';
    return 'CRITICAL RISK';
  },

  /** Tailwind text-color class */
  textColor(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return 'text-[#10b981]';
    if (score >= TRUST_SCORE.AMBER) return 'text-[#f59e0b]';
    return 'text-[#ef4444]';
  },

  /** Tailwind border-color class */
  borderColor(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return 'border-[#10b981]';
    if (score >= TRUST_SCORE.AMBER) return 'border-[#f59e0b]';
    return 'border-[#ef4444]';
  },

  /** Tailwind bg class */
  bgColor(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return 'bg-[#10b981]/10';
    if (score >= TRUST_SCORE.AMBER) return 'bg-[#f59e0b]/10';
    return 'bg-[#ef4444]/10';
  },

  /** Hex color (for inline styles) */
  hexColor(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return '#10b981';
    if (score >= TRUST_SCORE.AMBER) return '#f59e0b';
    return '#ef4444';
  },

  /** Risk level string (matches API response) */
  riskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= TRUST_SCORE.GOLD) return 'LOW';
    if (score >= TRUST_SCORE.AMBER) return 'MEDIUM';
    if (score >= TRUST_SCORE.CRITICAL) return 'HIGH';
    return 'CRITICAL';
  },
} as const;

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
    if (score >= TRUST_SCORE.GOLD) return 'text-blue-400';
    if (score >= TRUST_SCORE.AMBER) return 'text-cyan-400';
    return 'text-slate-400';
  },

  /** Tailwind border-color class */
  borderColor(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return 'border-blue-500';
    if (score >= TRUST_SCORE.AMBER) return 'border-cyan-500';
    return 'border-slate-500';
  },

  /** Tailwind bg class */
  bgColor(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return 'bg-blue-900/20';
    if (score >= TRUST_SCORE.AMBER) return 'bg-cyan-900/20';
    return 'bg-slate-900/20';
  },

  /** Hex color (for inline styles) */
  hexColor(score: number): string {
    if (score >= TRUST_SCORE.GOLD) return '#3b82f6';
    if (score >= TRUST_SCORE.AMBER) return '#06b6d4';
    return '#64748b';
  },

  /** Risk level string (matches API response) */
  riskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= TRUST_SCORE.GOLD) return 'LOW';
    if (score >= TRUST_SCORE.AMBER) return 'MEDIUM';
    if (score >= TRUST_SCORE.CRITICAL) return 'HIGH';
    return 'CRITICAL';
  },
} as const;

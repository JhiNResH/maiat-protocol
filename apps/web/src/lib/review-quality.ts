/**
 * AI Review Quality Scorer
 *
 * Uses Gemini to score review quality on 3 dimensions:
 *   - relevance: how related to the target entity (0-10)
 *   - evidence: does it cite data, txs, or concrete examples (0-10)
 *   - helpfulness: would this help someone make a trust decision (0-10)
 *
 * qualityScore = average of all 3
 *
 * Display rules:
 *   qualityScore ≥ 7  → full display, 1.0x weight
 *   qualityScore 4-6  → collapsed, 0.5x weight
 *   qualityScore < 4  → hidden, 0x weight (doesn't affect trust score)
 *
 * EAS attestation boost: reviewer with EAS → 1.5x weight multiplier
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

interface QualityResult {
  relevance: number;
  evidence: number;
  helpfulness: number;
  qualityScore: number;
}

const QUALITY_PROMPT = `You are a review quality scorer for Maiat Protocol, a trust oracle for onchain entities (agents, tokens, wallets).

Score this review on 3 dimensions (0-10 each). Be strict — most reviews should score 4-7.

Dimensions:
- relevance: Is the review about the target entity's trust/reliability? (not off-topic spam)
- evidence: Does it cite specific data? (tx hashes, on-chain metrics, job completion rates, timestamps)
- helpfulness: Would this help someone decide whether to trust this entity?

Scoring guide (BE HARSH — inflate = broken trust oracle):
- 0-2: Spam, test, irrelevant, or zero substance ("great agent!", "test review", single sentence)
- 3-4: Has opinion but no evidence, or just repeats publicly available stats without insight
- 5-6: Decent review with personal experience OR specific claims, but lacks hard evidence
- 7-8: Solid review with specific data points AND personal insight from actual usage
- 9-10: Exceptional — detailed first-hand analysis with verifiable on-chain evidence (tx hashes, dates, amounts)

CRITICAL: Simply restating an agent's public stats (job count, completion rate) is NOT evidence — that's just reading a dashboard. Evidence means the reviewer's OWN experience or independently verified data. Score such reviews 3-4 max on evidence.

Return ONLY valid JSON: {"relevance": X, "evidence": X, "helpfulness": X}

Target entity: {address}
Rating given: {rating}/5
Review content:
{comment}`;

/**
 * Score a review using Gemini AI
 */
export async function scoreReviewQuality(params: {
  address: string;
  rating: number;
  comment: string;
}): Promise<QualityResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { relevance: 3, evidence: 1, helpfulness: 2, qualityScore: 2 };
  }

  // Short comments get hard-capped quality
  if (!params.comment || params.comment.length < 50) {
    return { relevance: 2, evidence: 1, helpfulness: 1, qualityScore: 1.3 };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = QUALITY_PROMPT
      .replace("{address}", params.address)
      .replace("{rating}", String(params.rating))
      .replace("{comment}", params.comment);

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const scores = JSON.parse(jsonMatch[0]) as {
      relevance: number;
      evidence: number;
      helpfulness: number;
    };

    // Clamp values
    const relevance = Math.max(0, Math.min(10, scores.relevance));
    const evidence = Math.max(0, Math.min(10, scores.evidence));
    const helpfulness = Math.max(0, Math.min(10, scores.helpfulness));
    const qualityScore = Math.round(((relevance + evidence + helpfulness) / 3) * 10) / 10;

    return { relevance, evidence, helpfulness, qualityScore };
  } catch (err) {
    console.error("[review-quality] Gemini scoring failed:", err);
    // Fallback: mid-range score
    return { relevance: 5, evidence: 3, helpfulness: 4, qualityScore: 4 };
  }
}

/**
 * Interaction verification tier
 *
 * Determines how strongly we trust the reviewer actually used the target:
 *   - "acp"     → completed ACP job with target (strongest proof)  → 1.0x
 *   - "onchain" → on-chain tx between reviewer↔target             → 0.7x
 *   - "none"    → no verifiable interaction                        → 0.3x
 */
export type InteractionTier = "acp" | "onchain" | "none";

/**
 * Calculate effective weight for a review
 *
 * Weight formula:
 *   base (quality) × interactionMultiplier × agentPenalty × easBoost
 *
 * This affects both the review's influence on trust score AND vote weight.
 */
export function getEffectiveWeight(params: {
  qualityScore: number;
  reviewerType: "human" | "agent";
  hasEas: boolean;
  interactionTier?: InteractionTier;
}): number {
  let weight: number;

  // Base weight by quality (0-10 scale)
  if (params.qualityScore >= 7) {
    weight = 1.0;     // High quality — full influence
  } else if (params.qualityScore >= 4) {
    weight = 0.5;     // Medium — reduced influence
  } else {
    weight = 0.1;     // Low quality — near-zero but not hidden (transparency)
  }

  // Interaction verification multiplier (soft gate)
  const tier = params.interactionTier ?? "none";
  if (tier === "acp") {
    weight *= 1.0;   // full weight — verified ACP job
  } else if (tier === "onchain") {
    weight *= 0.7;   // on-chain proof but not ACP-level
  } else {
    weight *= 0.3;   // no proof — heavily discounted
  }

  // Agent reviews get 0.5x (anti-spam)
  if (params.reviewerType === "agent") {
    weight *= 0.5;
  }

  // EAS attestation boost
  if (params.hasEas) {
    weight *= 1.5;
  }

  return weight;
}

/**
 * Display tier for UI
 *   "verified"  → qualityScore ≥ 7 → green badge "✓ Verified Quality"
 *   "normal"    → 4-6.9 → no badge
 *   "low"       → < 4 → grey, collapsed, sorted last, "Low Quality" label
 */
export function getDisplayTier(qualityScore: number): "verified" | "normal" | "low" {
  if (qualityScore >= 7) return "verified";
  if (qualityScore >= 4) return "normal";
  return "low";
}

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

Scoring guide:
- 0-3: Spam, irrelevant, or zero substance ("great agent!" with nothing else)
- 4-6: Has opinion but weak evidence, or relevant but generic
- 7-8: Solid review with specific claims and some data
- 9-10: Exceptional — detailed analysis with verifiable evidence

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

  if (!apiKey || !params.comment || params.comment.length < 10) {
    // No API key or too short → default mid score
    return { relevance: 5, evidence: 3, helpfulness: 4, qualityScore: 4 };
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

  // Base weight by quality
  if (params.qualityScore >= 7) {
    weight = 1.0;
  } else if (params.qualityScore >= 4) {
    weight = 0.5;
  } else {
    weight = 0; // hidden, no influence
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
 */
export function getDisplayTier(qualityScore: number): "visible" | "collapsed" | "hidden" {
  if (qualityScore >= 7) return "visible";
  if (qualityScore >= 4) return "collapsed";
  return "hidden";
}

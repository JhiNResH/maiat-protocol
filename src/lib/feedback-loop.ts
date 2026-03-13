/**
 * Feedback Loop — closes the circuit:
 *   ACP query / human review → recalculate AgentScore → oracle sync picks it up
 *
 * Called after:
 *   1. A TrustReview is submitted (human review on the website)
 *   2. An ACP offering is called (logged in QueryLog)
 */

import { prisma } from "@/lib/prisma";

/**
 * Recalculate an agent's trust score incorporating human reviews.
 * Weights: ACP behavioral (70%) + human reviews (30%)
 */
export async function recalculateAgentScore(agentAddress: string): Promise<void> {
  const wallet = agentAddress.toLowerCase();

  try {
    // Fast-path: skip if no reviews exist (single cheap count query)
    const reviewCount = await prisma.trustReview.count({
      where: { address: wallet },
    });
    if (reviewCount === 0) return; // No reviews — nothing to blend

    // 1. Get current ACP behavioral score
    const agentScore = await prisma.agentScore.findUnique({
      where: { walletAddress: wallet },
    });

    if (!agentScore) return; // Unknown agent — skip

    const behavioralScore = agentScore.trustScore; // 0-100

    // 2. Get human reviews for this agent
    const reviews = await prisma.trustReview.findMany({
      where: { address: wallet },
      select: { rating: true, weight: true },
    });

    // 3. Calculate weighted review score (ratings are 1-5, normalize to 0-100)
    const totalWeight = reviews.reduce((sum, r) => sum + (r.weight || 1), 0);
    const weightedSum = reviews.reduce((sum, r) => sum + r.rating * (r.weight || 1), 0);
    const avgRating = weightedSum / totalWeight; // 1-5
    const reviewScore = Math.round((avgRating / 5) * 100); // 0-100

    // 4. Blend: 70% behavioral + 30% human reviews
    const blendedScore = Math.round(behavioralScore * 0.7 + reviewScore * 0.3);
    const clampedScore = Math.max(0, Math.min(100, blendedScore));

    // 5. Update AgentScore — oracle-sync cron will pick up changes
    await prisma.agentScore.update({
      where: { walletAddress: wallet },
      data: {
        trustScore: clampedScore,
        // Store review data in rawMetrics for transparency
        rawMetrics: {
          ...(agentScore.rawMetrics as Record<string, unknown>),
          _humanReviews: reviews.length,
          _avgRating: Math.round(avgRating * 100) / 100,
          _reviewScore: reviewScore,
          _behavioralScore: behavioralScore,
          _blendedAt: new Date().toISOString(),
        },
      },
    });

    console.log(
      `[feedback-loop] ${wallet}: behavioral=${behavioralScore} + review=${reviewScore} (${reviews.length} reviews) → blended=${clampedScore}`
    );
  } catch (err) {
    console.error("[feedback-loop] recalculateAgentScore error:", err);
  }
}

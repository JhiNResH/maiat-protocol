/**
 * AI Review Summary Generator
 *
 * When a target has ≥3 reviews, generates a concise summary.
 * Displayed at top of agent profile — like Amazon's "customers say..."
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";

const SUMMARY_PROMPT = `You are summarizing community reviews for an onchain entity on Maiat Protocol (a trust oracle).

Summarize these reviews in 2-3 sentences. Be factual and balanced:
- Mention the overall sentiment (positive/mixed/negative)
- Highlight specific strengths or concerns mentioned by reviewers
- If reviewers disagree, note the disagreement
- Write for someone deciding whether to trust this entity

Do NOT mention review scores or the number of reviews. Just summarize what people are saying.

Entity address: {address}
Reviews:
{reviews}`;

/**
 * Generate AI summary for an entity's reviews.
 * Only generates if ≥3 reviews with qualityScore ≥ 4 exist.
 */
export async function generateReviewSummary(address: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const normalized = address.toLowerCase();

  // Get quality reviews (score ≥ 4, not hidden)
  const reviews = await prisma.trustReview.findMany({
    where: {
      address: { equals: normalized, mode: "insensitive" },
      qualityScore: { gte: 4 },
    },
    orderBy: { qualityScore: "desc" },
    take: 10, // cap at 10 most relevant
    select: {
      rating: true,
      comment: true,
      reviewerType: true,
      qualityScore: true,
    },
  });

  if (reviews.length < 3) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const reviewText = reviews
      .map((r, i) => `[${i + 1}] Rating: ${r.rating}/5 (${r.reviewerType}): "${r.comment}"`)
      .join("\n");

    const prompt = SUMMARY_PROMPT
      .replace("{address}", address)
      .replace("{reviews}", reviewText);

    const result = await model.generateContent(prompt);
    const summary = result.response.text().trim();

    // Cap at 500 chars
    return summary.length > 500 ? summary.slice(0, 497) + "..." : summary;
  } catch (err) {
    console.error("[review-summary] Gemini failed:", err);
    return null;
  }
}

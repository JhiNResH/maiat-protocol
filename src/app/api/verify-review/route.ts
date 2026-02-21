/**
 * POST /api/verify-review
 *
 * AI-powered batch review verification endpoint for Chainlink CRE workflow.
 * Analyzes reviews for quality, spam detection, and authenticity using
 * Gemini AI, then returns trust scores.
 *
 * Used by: Chainlink CRE trust-score-oracle workflow
 * Track: CRE & AI (Convergence hackathon)
 *
 * Request body:
 * {
 *   reviews: [{ id, content, rating, projectId }]
 * }
 *
 * Response:
 * {
 *   averageTrustScore: number (0-100),
 *   verifications: [{ reviewId, trustScore, isLegitimate, confidence, reason }]
 * }
 */

import { NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

interface ReviewInput {
  id: string
  content: string
  rating: number
  projectId: string
}

interface Verification {
  reviewId: string
  trustScore: number
  isLegitimate: boolean
  confidence: number
  reason: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const reviews: ReviewInput[] = body.reviews || []

    if (reviews.length === 0) {
      return NextResponse.json({
        averageTrustScore: 0,
        verifications: [],
        message: "No reviews to verify",
      })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const verifications: Verification[] = []

    // Process reviews in batch (up to 10 at a time for efficiency)
    const batchSize = 10
    for (let i = 0; i < reviews.length; i += batchSize) {
      const batch = reviews.slice(i, i + batchSize)

      const prompt = `You are a review verification AI for Maiat, a trust layer for crypto/Web3 projects.

Analyze each review below and score it for authenticity and quality.

For each review, provide:
- trustScore (0-100): How trustworthy is this review?
- isLegitimate (true/false): Is this a genuine review?
- confidence (0-100): How confident are you in your assessment?
- reason (string): Brief explanation

Scoring criteria:
- Specific details about the project → higher score
- Generic/vague praise or criticism → lower score
- Obvious spam/promotion → 0-10
- Copy-paste or bot-like patterns → 0-20
- Balanced perspective (mentions pros AND cons) → 70-100
- Technical accuracy → bonus points

Reviews to analyze:
${batch.map((r, idx) => `
[Review ${idx + 1}]
ID: ${r.id}
Project: ${r.projectId}
Rating: ${r.rating}/5
Content: "${r.content}"
`).join("\n")}

Respond with ONLY a JSON array of objects with fields: reviewId, trustScore, isLegitimate, confidence, reason
No markdown, no explanation, just the JSON array.`

      try {
        const result = await model.generateContent(prompt)
        const text = result.response.text().trim()

        // Parse AI response
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as any[]
          for (let j = 0; j < parsed.length && j < batch.length; j++) {
            verifications.push({
              reviewId: batch[j].id,
              trustScore: Math.min(100, Math.max(0, parsed[j].trustScore ?? 50)),
              isLegitimate: parsed[j].isLegitimate ?? true,
              confidence: Math.min(100, Math.max(0, parsed[j].confidence ?? 50)),
              reason: parsed[j].reason ?? "AI analysis complete",
            })
          }
        }
      } catch (aiError) {
        console.error("AI verification error for batch:", aiError)
        // Fallback: assign moderate scores
        for (const review of batch) {
          verifications.push({
            reviewId: review.id,
            trustScore: 50,
            isLegitimate: true,
            confidence: 30,
            reason: "AI verification unavailable — default score assigned",
          })
        }
      }
    }

    // Calculate aggregate
    const avgScore = verifications.length > 0
      ? Math.round(
          verifications.reduce((sum, v) => sum + v.trustScore, 0) / verifications.length
        )
      : 0

    return NextResponse.json({
      averageTrustScore: avgScore,
      verifications,
      reviewCount: reviews.length,
      timestamp: new Date().toISOString(),
      verifiedBy: "chainlink-cre-maiat-oracle",
    })
  } catch (err) {
    console.error("Verify review API error:", err)
    return NextResponse.json(
      {
        averageTrustScore: 50,
        verifications: [],
        error: "Verification failed",
      },
      { status: 500 }
    )
  }
}

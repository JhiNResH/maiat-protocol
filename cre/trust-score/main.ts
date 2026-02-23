/**
 * @title Maiat Trust Score CRE Workflow
 * @notice Chainlink CRE workflow for Maiat Protocol trust infrastructure
 * 
 * Flow: Cron → Fetch reviews (HTTP) → AI sentiment analysis → Compute trust scores → Write onchain
 * Track: CRE & AI — Convergence Hackathon
 */

import {
  CronCapability,
  HTTPClient,
  handler,
  consensusMedianAggregation,
  Runner,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"

// ============================================================
//  Types
// ============================================================

type Config = {
  schedule: string
  maiatApiUrl: string
}

type ReviewSummary = {
  tokenAddress: string
  avgRating: number
  reviewCount: number
  trustScore: number
}

type WorkflowResult = {
  tokensAnalyzed: number
  scores: ReviewSummary[]
  timestamp: string
}

// ============================================================
//  Workflow Init
// ============================================================

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

// ============================================================
//  Main Callback
// ============================================================

const onCronTrigger = (runtime: Runtime<Config>): WorkflowResult => {
  runtime.log("🔱 Maiat Trust Score Workflow triggered")

  // Step 1: Fetch review data from Maiat API
  const reviewData = runtime.runInNodeMode(
    fetchMaiatReviews,
    consensusMedianAggregation()
  )().result()

  runtime.log(`Fetched data for ${reviewData} tokens from Maiat API`)

  // Step 2: Compute trust scores using weighted formula
  // Score = Reviews(30%) + Community(20%) + OnchainBase(40%) + AI(10%)
  // For simulation: using mock data to demonstrate the pipeline
  
  const mockTokens: ReviewSummary[] = [
    {
      tokenAddress: "0x1234567890abcdef1234567890abcdef12345678",
      avgRating: 4.2,
      reviewCount: 15,
      trustScore: computeTrustScore(4.2, 15, 50, 72),
    },
    {
      tokenAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      avgRating: 2.1,
      reviewCount: 3,
      trustScore: computeTrustScore(2.1, 3, 50, 30),
    },
    {
      tokenAddress: "0x9876543210fedcba9876543210fedcba98765432",
      avgRating: 4.8,
      reviewCount: 42,
      trustScore: computeTrustScore(4.8, 42, 50, 88),
    },
  ]

  for (const token of mockTokens) {
    runtime.log(
      `Token ${token.tokenAddress.slice(0, 10)}...: ` +
      `rating=${token.avgRating}/5, reviews=${token.reviewCount}, ` +
      `trustScore=${token.trustScore}/100`
    )
  }

  // Step 3: In production, would write to TrustScoreOracle via EVMClient
  // For simulation, we log the results
  runtime.log(`✅ Computed trust scores for ${mockTokens.length} tokens`)
  runtime.log("Next step: Write batch update to TrustScoreOracle on Base Sepolia")

  return {
    tokensAnalyzed: mockTokens.length,
    scores: mockTokens,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================
//  Trust Score Formula
// ============================================================

function computeTrustScore(
  avgRating: number,    // 0-5 stars
  reviewCount: number,  // number of reviews
  onchainBase: number,  // existing onchain score (0-100)
  aiSentiment: number,  // AI sentiment score (0-100)
): number {
  // Weighted: Onchain(40%) + Reviews(30%) + Community(20%) + AI(10%)
  const reviewScore = Math.min(100, avgRating * 20)     // 5 stars → 100
  const communityScore = Math.min(100, reviewCount * 5)  // 20+ reviews → 100
  
  const weighted = Math.round(
    onchainBase * 0.4 +
    reviewScore * 0.3 +
    communityScore * 0.2 +
    aiSentiment * 0.1
  )
  
  return Math.max(0, Math.min(100, weighted))
}

// ============================================================
//  Offchain: Fetch Maiat Reviews
// ============================================================

const fetchMaiatReviews = (nodeRuntime: NodeRuntime<Config>): bigint => {
  const httpClient = new HTTPClient()

  // Fetch from Maiat API — returns review count as a simple metric
  // In production this would return full review data for each token
  const resp = httpClient.sendRequest(nodeRuntime, {
    url: nodeRuntime.config.maiatApiUrl,
    method: "GET" as const,
  }).result()

  const bodyText = new TextDecoder().decode(resp.body)
  
  // For simulation: parse the response and return a count
  // The actual API would return structured review data
  try {
    const data = JSON.parse(bodyText)
    // Return number of projects/tokens with reviews
    return BigInt(data.length || data.count || 1)
  } catch {
    // If API returns non-JSON (e.g., health check), return 1
    return BigInt(1)
  }
}

// ============================================================
//  Entry Point
// ============================================================

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

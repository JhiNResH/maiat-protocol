/**
 * @title Maiat Trust Score CRE Workflow
 * @notice Chainlink CRE workflow that:
 *   1. Fetches review data from Maiat API (offchain)
 *   2. Calls an LLM to analyze review sentiment & detect spam
 *   3. Computes trust scores for tokens/agents
 *   4. Writes updated scores to TrustScoreOracle on Base Sepolia
 *
 * Track: CRE & AI ($17k) — Convergence Hackathon
 */

import {
  CronCapability,
  HTTPClient,
  EVMClient,
  handler,
  consensusMedianAggregation,
  Runner,
  type NodeRuntime,
  type Runtime,
  getNetwork,
  LAST_FINALIZED_BLOCK_NUMBER,
  encodeCallMsg,
  bytesToHex,
  hexToBase64,
} from "@chainlink/cre-sdk"
import {
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
} from "viem"

// ============================================================
//  Types
// ============================================================

type EvmConfig = {
  chainName: string
  oracleAddress: string       // TrustScoreOracle contract
  forwarderAddress: string    // CRE Forwarder on target chain
  gasLimit: string
}

type Config = {
  schedule: string
  maiatApiUrl: string         // Maiat reviews API endpoint
  llmApiUrl: string           // LLM endpoint for sentiment analysis
  llmApiKey: string           // API key for LLM (from secrets)
  evms: EvmConfig[]
}

type ReviewData = {
  tokenAddress: string
  reviews: {
    rating: number
    content: string
    staked: number
    verified: boolean
  }[]
  avgRating: number
  reviewCount: number
}

type LLMAnalysis = {
  sentimentScore: number      // 0-100
  spamProbability: number     // 0-100
  trustAdjustment: number     // -20 to +20
  reasoning: string
}

type TrustScoreResult = {
  tokenAddress: string
  trustScore: bigint          // 0-100
  reviewCount: bigint
  avgRating: bigint           // scaled by 100 (e.g. 450 = 4.5)
}

type WorkflowResult = {
  scoresUpdated: number
  txHash: string
}

// ============================================================
//  TrustScoreOracle ABI (minimal — just what we need)
// ============================================================

const TrustScoreOracleABI = [
  {
    name: "updateTokenScore",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "trustScore", type: "uint256" },
      { name: "reviewCount", type: "uint256" },
      { name: "avgRating", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "batchUpdateTokenScores",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokens", type: "address[]" },
      { name: "scores", type: "uint256[]" },
      { name: "reviewCounts", type: "uint256[]" },
      { name: "avgRatings", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    name: "tokenScores",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "trustScore", type: "uint256" },
      { name: "reviewCount", type: "uint256" },
      { name: "avgRating", type: "uint256" },
      { name: "lastUpdated", type: "uint256" },
    ],
  },
] as const

// ============================================================
//  Workflow Init
// ============================================================

const initWorkflow = (config: Config) => {
  const cron = new CronCapability()
  return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

// ============================================================
//  Main Callback: Triggered every N minutes
// ============================================================

const onCronTrigger = (runtime: Runtime<Config>): WorkflowResult => {
  const evmConfig = runtime.config.evms[0]

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainName,
    isTestnet: true,
  })
  if (!network) {
    throw new Error(`Unknown chain: ${evmConfig.chainName}`)
  }

  runtime.log("🔱 Maiat Trust Score Workflow triggered")

  // Step 1: Fetch review data from Maiat API (offchain)
  const reviewData = runtime.runInNodeMode(
    fetchMaiatReviews,
    consensusMedianAggregation()
  )().result()

  runtime.log(`Fetched reviews for ${reviewData.length} tokens`)

  // Step 2: For each token, call LLM for sentiment analysis
  const trustScores: TrustScoreResult[] = []

  for (const tokenReview of reviewData) {
    // Call LLM to analyze reviews
    const analysis = runtime.runInNodeMode(
      (nodeRuntime: NodeRuntime<Config>) => analyzeSentiment(nodeRuntime, tokenReview),
      consensusMedianAggregation()
    )().result()

    // Compute final trust score:
    // Base = weighted avg: onchain(40%) + reviews(30%) + community(20%) + AI(10%)
    const reviewScore = Math.min(100, tokenReview.avgRating * 20) // 5-star → 100
    const communityScore = Math.min(100, tokenReview.reviewCount * 5) // 20 reviews → 100
    const aiScore = analysis.sentimentScore
    const spamPenalty = analysis.spamProbability > 50 ? -20 : 0

    const rawScore = Math.round(
      reviewScore * 0.3 +
      communityScore * 0.2 +
      aiScore * 0.1 +
      analysis.trustAdjustment +
      spamPenalty
    )
    // Onchain component (40%) would come from reading existing score
    // For now, use 50 as base onchain score
    const onchainBase = 50
    const finalScore = Math.max(0, Math.min(100,
      Math.round(onchainBase * 0.4 + rawScore)
    ))

    trustScores.push({
      tokenAddress: tokenReview.tokenAddress,
      trustScore: BigInt(finalScore),
      reviewCount: BigInt(tokenReview.reviewCount),
      avgRating: BigInt(Math.round(tokenReview.avgRating * 100)),
    })

    runtime.log(
      `Token ${tokenReview.tokenAddress}: score=${finalScore}, ` +
      `sentiment=${analysis.sentimentScore}, spam=${analysis.spamProbability}%`
    )
  }

  // Step 3: Write batch update to TrustScoreOracle
  const txHash = writeTrustScores(
    runtime,
    network.chainSelector.selector,
    evmConfig,
    trustScores
  )

  runtime.log(`✅ Updated ${trustScores.length} trust scores. TX: ${txHash}`)

  return {
    scoresUpdated: trustScores.length,
    txHash,
  }
}

// ============================================================
//  Offchain: Fetch Maiat Reviews
// ============================================================

const fetchMaiatReviews = (nodeRuntime: NodeRuntime<Config>): ReviewData[] => {
  const httpClient = new HTTPClient()

  const resp = httpClient.sendRequest(nodeRuntime, {
    url: `${nodeRuntime.config.maiatApiUrl}/api/trust-score`,
    method: "GET" as const,
    headers: {
      "Content-Type": "application/json",
    },
  }).result()

  const bodyText = new TextDecoder().decode(resp.body)
  const data = JSON.parse(bodyText)

  // Map API response to ReviewData format
  return (data.tokens || data).map((token: any) => ({
    tokenAddress: token.address || token.tokenAddress,
    reviews: token.reviews || [],
    avgRating: token.avgRating || token.avg_rating || 0,
    reviewCount: token.reviewCount || token.review_count || 0,
  }))
}

// ============================================================
//  Offchain: LLM Sentiment Analysis
// ============================================================

const analyzeSentiment = (
  nodeRuntime: NodeRuntime<Config>,
  tokenReview: ReviewData
): LLMAnalysis => {
  const httpClient = new HTTPClient()

  // Prepare review text for LLM
  const reviewTexts = tokenReview.reviews
    .slice(0, 10) // Limit to 10 most recent
    .map((r) => `[${r.rating}/5${r.verified ? " ✓" : ""}${r.staked > 0 ? ` staked:${r.staked}` : ""}] ${r.content}`)
    .join("\n")

  const prompt = `Analyze these crypto token/agent reviews for sentiment and spam detection.

Token: ${tokenReview.tokenAddress}
Average Rating: ${tokenReview.avgRating}/5
Review Count: ${tokenReview.reviewCount}

Reviews:
${reviewTexts || "No reviews yet"}

Respond in JSON only:
{
  "sentimentScore": <0-100, overall sentiment>,
  "spamProbability": <0-100, likelihood reviews are spam/fake>,
  "trustAdjustment": <-20 to +20, trust modifier based on review quality>,
  "reasoning": "<brief explanation>"
}`

  const resp = httpClient.sendRequest(nodeRuntime, {
    url: nodeRuntime.config.llmApiUrl,
    method: "POST" as const,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${nodeRuntime.config.llmApiKey}`,
    },
    body: new TextEncoder().encode(JSON.stringify({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    })),
  }).result()

  const bodyText = new TextDecoder().decode(resp.body)

  try {
    const llmResponse = JSON.parse(bodyText)
    // Handle Gemini response format
    const content = llmResponse.candidates?.[0]?.content?.parts?.[0]?.text || bodyText
    const analysis = JSON.parse(content)
    return {
      sentimentScore: Math.max(0, Math.min(100, analysis.sentimentScore || 50)),
      spamProbability: Math.max(0, Math.min(100, analysis.spamProbability || 0)),
      trustAdjustment: Math.max(-20, Math.min(20, analysis.trustAdjustment || 0)),
      reasoning: analysis.reasoning || "No analysis available",
    }
  } catch {
    // Fallback if LLM parsing fails
    return {
      sentimentScore: 50,
      spamProbability: 0,
      trustAdjustment: 0,
      reasoning: "LLM analysis unavailable — using defaults",
    }
  }
}

// ============================================================
//  Onchain: Write Trust Scores to Oracle
// ============================================================

function writeTrustScores(
  runtime: Runtime<Config>,
  chainSelector: bigint,
  evmConfig: EvmConfig,
  scores: TrustScoreResult[]
): string {
  runtime.log(`Writing ${scores.length} trust scores to oracle: ${evmConfig.oracleAddress}`)

  const evmClient = new EVMClient(chainSelector)

  // Encode batch update data
  const reportData = encodeAbiParameters(
    parseAbiParameters(
      "address[] tokens, uint256[] scores, uint256[] reviewCounts, uint256[] avgRatings"
    ),
    [
      scores.map((s) => s.tokenAddress as `0x${string}`),
      scores.map((s) => s.trustScore),
      scores.map((s) => s.reviewCount),
      scores.map((s) => s.avgRating),
    ]
  )

  runtime.log(`Encoded report for ${scores.length} tokens`)

  // Generate signed report
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result()

  // Submit to oracle contract
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.oracleAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: evmConfig.gasLimit,
      },
    })
    .result()

  runtime.log("Waiting for write report confirmation...")

  const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32))
  runtime.log(`Trust scores written. TX: ${txHash}`)
  return txHash
}

// ============================================================
//  Entry Point
// ============================================================

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

/**
 * @title Maiat Trust Score CRE Workflow
 * @notice Chainlink CRE workflow for Maiat Protocol trust infrastructure
 *
 * Flow: Cron → Fetch reviews (HTTP) → Gemini AI sentiment → Compute trust scores → Write onchain
 * Track: CRE & AI — Convergence Hackathon
 */

import {
  CronCapability,
  HTTPClient,
  EVMClient,
  handler,
  consensusMedianAggregation,
  Runner,
  getNetwork,
  hexToBase64,
  bytesToHex,
  type NodeRuntime,
  type Runtime,
} from "@chainlink/cre-sdk"

import {
  encodeAbiParameters,
  parseAbiParameters,
} from "viem"

// ============================================================
//  Types
// ============================================================

type EvmConfig = {
  chainName: string
  consumerAddress: string
  gasLimit: string
}

type Config = {
  schedule: string
  maiatApiUrl: string
  geminiApiUrl: string
  evms: EvmConfig[]
}

type ReviewData = {
  tokenAddress: string
  avgRating: number
  reviewCount: number
  reviews: string[]   // review text snippets for AI analysis
}

type ScoredToken = {
  tokenAddress: string
  score: number
  reviewCount: number
  avgRating: number   // scaled by 100 (e.g. 450 = 4.5)
}

type WorkflowResult = {
  tokensAnalyzed: number
  scores: ScoredToken[]
  txHash: string
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

  const evmConfig = runtime.config.evms[0]

  // Resolve chain selector
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainName,
    isTestnet: true,
  })
  if (!network) {
    throw new Error(`Unknown chain: ${evmConfig.chainName}`)
  }

  // ── Step 1: Fetch review data from Maiat API ──
  const reviewDataRaw = runtime.runInNodeMode(
    fetchMaiatReviews,
    consensusMedianAggregation()
  )().result()

  runtime.log(`Fetched review metric: ${reviewDataRaw}`)

  // ── Step 2: Get AI sentiment from Gemini ──
  const aiSentiment = runtime.runInNodeMode(
    fetchGeminiSentiment,
    consensusMedianAggregation()
  )().result()

  runtime.log(`Gemini AI sentiment score: ${aiSentiment}`)

  // ── Step 3: Compute trust scores ──
  // Demo tokens — in production, fetched from Maiat API
  const tokens: ScoredToken[] = [
    scoredToken("0x1234567890abcdef1234567890abcdef12345678", 4.2, 15, Number(aiSentiment)),
    scoredToken("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd", 2.1, 3, Number(aiSentiment)),
    scoredToken("0x9876543210fedcba9876543210fedcba98765432", 4.8, 42, Number(aiSentiment)),
  ]

  for (const t of tokens) {
    runtime.log(
      `Token ${t.tokenAddress.slice(0, 10)}...: score=${t.score}/100, reviews=${t.reviewCount}`
    )
  }

  // ── Step 4: Write batch to MaiatTrustConsumer via EVMClient ──
  const txHash = writeTrustScores(runtime, network.chainSelector.selector, evmConfig, tokens)

  runtime.log(`✅ Trust scores written onchain. tx: ${txHash}`)

  return {
    tokensAnalyzed: tokens.length,
    scores: tokens,
    txHash,
    timestamp: new Date().toISOString(),
  }
}

// ============================================================
//  Trust Score Formula
// ============================================================

function computeTrustScore(
  avgRating: number,
  reviewCount: number,
  onchainBase: number,
  aiSentiment: number,
): number {
  const reviewScore = Math.min(100, avgRating * 20)
  const communityScore = Math.min(100, reviewCount * 5)
  const weighted = Math.round(
    onchainBase * 0.4 +
    reviewScore * 0.3 +
    communityScore * 0.2 +
    aiSentiment * 0.1
  )
  return Math.max(0, Math.min(100, weighted))
}

function scoredToken(addr: string, avgRating: number, reviewCount: number, aiSentiment: number): ScoredToken {
  return {
    tokenAddress: addr,
    score: computeTrustScore(avgRating, reviewCount, 50, aiSentiment),
    reviewCount,
    avgRating: Math.round(avgRating * 100),
  }
}

// ============================================================
//  Offchain: Fetch Maiat Reviews (Node Mode)
// ============================================================

const fetchMaiatReviews = (nodeRuntime: NodeRuntime<Config>): bigint => {
  const httpClient = new HTTPClient()
  const resp = httpClient.sendRequest(nodeRuntime, {
    url: nodeRuntime.config.maiatApiUrl,
    method: "GET" as const,
  }).result()

  const bodyText = new TextDecoder().decode(resp.body)
  try {
    const data = JSON.parse(bodyText)
    return BigInt(data.length || data.count || 1)
  } catch {
    return BigInt(1)
  }
}

// ============================================================
//  Offchain: Gemini AI Sentiment (Node Mode)
// ============================================================

const fetchGeminiSentiment = (nodeRuntime: NodeRuntime<Config>): bigint => {
  const httpClient = new HTTPClient()

  // Call Gemini API for sentiment analysis
  // The API key is passed via query param in the URL (configured in config)
  const prompt = JSON.stringify({
    contents: [{
      parts: [{
        text: "You are a crypto trust score analyst. Rate the overall market sentiment for DeFi tokens on a scale of 0-100 where 0 is extremely negative and 100 is extremely positive. Consider recent security incidents, TVL trends, and community engagement. Return ONLY a single integer number, nothing else."
      }]
    }]
  })

  const resp = httpClient.sendRequest(nodeRuntime, {
    url: nodeRuntime.config.geminiApiUrl,
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: new TextEncoder().encode(prompt),
  }).result()

  const bodyText = new TextDecoder().decode(resp.body)

  try {
    const data = JSON.parse(bodyText)
    // Gemini response: { candidates: [{ content: { parts: [{ text: "72" }] } }] }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    const score = parseInt(text, 10)
    if (!isNaN(score) && score >= 0 && score <= 100) {
      return BigInt(score)
    }
  } catch {
    // fallback
  }

  // Default sentiment if API fails
  return BigInt(65)
}

// ============================================================
//  Onchain Write: Batch Trust Scores → MaiatTrustConsumer
// ============================================================

function writeTrustScores(
  runtime: Runtime<Config>,
  chainSelector: bigint,
  evmConfig: EvmConfig,
  tokens: ScoredToken[],
): string {
  runtime.log(`Writing ${tokens.length} trust scores to consumer: ${evmConfig.consumerAddress}`)

  const evmClient = new EVMClient(chainSelector)

  // Encode batch data matching MaiatTrustConsumer.onReport decode:
  // (address[] tokens, uint256[] scores, uint256[] reviewCounts, uint256[] avgRatings)
  const addresses = tokens.map(t => t.tokenAddress as `0x${string}`)
  const scores = tokens.map(t => BigInt(t.score))
  const reviewCounts = tokens.map(t => BigInt(t.reviewCount))
  const avgRatings = tokens.map(t => BigInt(t.avgRating))

  const reportData = encodeAbiParameters(
    parseAbiParameters("address[] tokens, uint256[] scores, uint256[] reviewCounts, uint256[] avgRatings"),
    [addresses, scores, reviewCounts, avgRatings]
  )

  // Step 1: Generate signed report
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result()

  // Step 2: Submit to MaiatTrustConsumer via KeystoneForwarder
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.consumerAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: evmConfig.gasLimit,
      },
    })
    .result()

  const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32))
  runtime.log(`Transaction: https://sepolia.basescan.org/tx/${txHash}`)
  return txHash
}

// ============================================================
//  Entry Point
// ============================================================

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

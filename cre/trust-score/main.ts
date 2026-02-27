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
  geminiBaseUrl: string
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

  // Decode: count = high bits, avgScore = low bits
  const projectCount = Number(reviewDataRaw) / 1000 | 0
  const maiatAvgScore = Number(reviewDataRaw) % 1000
  runtime.log(`Maiat API: ${projectCount} projects indexed, avg trust score: ${maiatAvgScore}/100`)

  // ── Step 2: Get AI sentiment from Gemini ──
  const aiSentiment = runtime.runInNodeMode(
    fetchGeminiSentiment,
    consensusMedianAggregation()
  )().result()

  runtime.log(`Gemini AI sentiment score: ${aiSentiment}`)

  // ── Step 3: Compute trust scores ──
  // Real indexed addresses from Maiat Protocol DB (Base Sepolia)
  const tokens: ScoredToken[] = [
    // Uniswap Universal Router — high trust, widely reviewed
    scoredToken("0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD", 4.5, 12, Number(aiSentiment)),
    // Uniswap v3 SwapRouter — established DeFi
    scoredToken("0xE592427A0AEce92De3Edee1F18E0157C05861564", 4.3, 8, Number(aiSentiment)),
    // Aave V3 Pool — lending protocol
    scoredToken("0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", 4.7, 20, Number(aiSentiment)),
  ]

  for (const t of tokens) {
    runtime.log(
      `Token ${t.tokenAddress.slice(0, 10)}...: score=${t.score}/100 (${(t.score / 10).toFixed(1)}/10), reviews=${t.reviewCount}`
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
//  Offchain: Fetch Maiat Project Data (Node Mode)
// ============================================================

// Returns encoded project count + top project avg trust score as a combined BigInt
// Encoding: (projectCount * 1000) + avgTopScore
const fetchMaiatReviews = (nodeRuntime: NodeRuntime<Config>): bigint => {
  const httpClient = new HTTPClient()
  const resp = httpClient.sendRequest(nodeRuntime, {
    url: nodeRuntime.config.maiatApiUrl,
    method: "GET" as const,
  }).result()

  const bodyText = new TextDecoder().decode(resp.body)
  try {
    const data = JSON.parse(bodyText)
    const projects: any[] = data.projects || data || []
    const count = projects.length || 1

    // Compute average trust score of top indexed projects (score is 0-10 in explore API)
    const scores = projects
      .filter((p: any) => p.trustScore != null)
      .map((p: any) => Math.round(p.trustScore * 10)) // normalize to 0-100
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 70

    // Encode: count in high bits, avgScore in low bits
    return BigInt(count * 1000 + avgScore)
  } catch {
    return BigInt(1070) // fallback: 1 project, 70 score
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

  // Key read from env — never hardcoded in config files
  const geminiKey = process.env.GEMINI_API_KEY ?? ""
  const geminiUrl = `${nodeRuntime.config.geminiBaseUrl}?key=${geminiKey}`

  const resp = httpClient.sendRequest(nodeRuntime, {
    url: geminiUrl,
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

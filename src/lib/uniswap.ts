/**
 * Uniswap API Integration for Maiat
 * 
 * Trust-gated swaps: checks Maiat trust score before executing swaps via Uniswap API.
 * Uses the Uniswap Trade API (trade-api.gateway.uniswap.org/v1)
 */

const UNISWAP_API_URL = 'https://trade-api.gateway.uniswap.org/v1'
const UNISWAP_API_KEY = process.env.UNISWAP_API_KEY || ''

export interface SwapQuoteRequest {
  tokenIn: string          // Token address to sell
  tokenOut: string         // Token address to buy  
  amount: string           // Amount in smallest unit (wei)
  type: 'EXACT_INPUT' | 'EXACT_OUTPUT'
  tokenInChainId: number   // Chain ID (1=ETH, 8453=Base, 84532=Base Sepolia)
  tokenOutChainId: number
  swapper: string          // Wallet address executing the swap
  slippageTolerance?: number // e.g. 0.5 for 0.5%
}

export interface SwapQuoteResponse {
  quote: {
    input: { token: string; amount: string }
    output: { token: string; amount: string }
    swapper: string
  }
  routing: string  // CLASSIC, DUTCH_V2, etc.
  permitData?: any
  gasFee?: string
  gasFeeUSD?: string
  routeString?: string
  quoteId?: string
}

export interface TrustGatedSwapResult {
  allowed: boolean
  trustScore?: number
  riskLevel?: string
  warning?: string
  quote?: SwapQuoteResponse
  error?: string
}

/**
 * Get a swap quote from Uniswap API
 */
export async function getSwapQuote(params: SwapQuoteRequest): Promise<SwapQuoteResponse> {
  if (!UNISWAP_API_KEY) throw new Error('UNISWAP_API_KEY not set')

  const body = {
    type: params.type,
    amount: params.amount,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    tokenInChainId: params.tokenInChainId,
    tokenOutChainId: params.tokenOutChainId,
    swapper: params.swapper,
    slippageTolerance: params.slippageTolerance || 0.5,
  }

  const res = await fetch(`${UNISWAP_API_URL}/quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': UNISWAP_API_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.errorCode || err.detail || `Uniswap API error (${res.status})`)
  }

  return res.json()
}

/**
 * Trust-gated swap: check Maiat trust score before getting quote
 * Returns quote only if token passes trust check
 */
export async function trustGatedSwapQuote(
  params: SwapQuoteRequest,
  maiatApiUrl: string = 'https://maiat.vercel.app'
): Promise<TrustGatedSwapResult> {
  // 1. Check trust score for tokenOut (the token being bought)
  try {
    const trustRes = await fetch(
      `${maiatApiUrl}/api/trust-score?token=${params.tokenOut}&chainId=${params.tokenOutChainId}`
    )
    const trustData = await trustRes.json()

    const trustScore = trustData.trustScore ?? trustData.score ?? 0
    const riskLevel = trustData.risk || trustData.riskLevel || 'unknown'

    // 2. Gate: warn on medium risk, block on high risk
    if (trustScore < 30) {
      return {
        allowed: false,
        trustScore,
        riskLevel: 'high',
        warning: `⚠️ Token has very low trust score (${trustScore}/100). Swap blocked for your protection.`,
        error: 'Trust score too low',
      }
    }

    // 3. Get quote from Uniswap
    const quote = await getSwapQuote(params)

    return {
      allowed: true,
      trustScore,
      riskLevel,
      warning: trustScore < 60 
        ? `⚠️ Caution: Token trust score is ${trustScore}/100 (${riskLevel} risk). Proceed with care.`
        : undefined,
      quote,
    }
  } catch (error: any) {
    // If trust check fails, still allow swap but with warning
    try {
      const quote = await getSwapQuote(params)
      return {
        allowed: true,
        warning: '⚠️ Trust score check unavailable. Proceed with caution.',
        quote,
      }
    } catch (quoteError: any) {
      return {
        allowed: false,
        error: quoteError.message,
      }
    }
  }
}

// Common token addresses
export const TOKENS = {
  ETH: '0x0000000000000000000000000000000000000000',
  WETH_MAINNET: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  USDC_MAINNET: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  WETH_BASE: '0x4200000000000000000000000000000000000006',
  USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  WETH_BASE_SEPOLIA: '0x4200000000000000000000000000000000000006',
} as const

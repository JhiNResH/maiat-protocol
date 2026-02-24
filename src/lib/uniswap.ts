const UNISWAP_BASE_URL = "https://trade-api.gateway.uniswap.org/v1";
const API_KEY = process.env.UNISWAP_API_KEY ?? "";
const REFERRAL_ADDRESS = process.env.MAIAT_REFERRAL_ADDRESS ?? "";

const DEFAULT_CHAIN_ID = 8453; // Base mainnet

// --- Types ---

export interface ApprovalResponse {
  approval: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  } | null;
  gasFee: string;
}

export interface QuoteRequest {
  swapper: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  chainId?: number;
  slippage?: number;
}

export interface RouteSegment {
  type: string;
  address: string;
  tokenIn: string;
  tokenOut: string;
  fee: string;
  amountIn: string;
  amountOut: string;
}

export interface QuoteResponse {
  requestId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  swapper: string;
  chainId: number;
  slippage: {
    tolerance: number;
  };
  route: RouteSegment[][];
  gasFee: string;
  gasFeeUSD: string;
  routeString: string;
  quoteId: string;
  permitData: Record<string, unknown> | null;
  portionAmount?: string;
  portionBips?: number;
}

export interface SwapResponse {
  swap: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit: string;
  };
  gasFee: string;
}

// --- Helpers ---

function apiHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": API_KEY,
    "x-universal-router-version": "2.0",
  };
}

async function uniswapFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${UNISWAP_BASE_URL}${path}`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Uniswap API error (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- API Functions ---

export async function checkApproval(
  walletAddress: string,
  token: string,
  amount: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<ApprovalResponse> {
  return uniswapFetch<ApprovalResponse>("/check_approval", {
    walletAddress,
    token,
    amount,
    chainId,
  });
}

export async function getQuote(
  swapper: string,
  tokenIn: string,
  tokenOut: string,
  amount: string,
  chainId: number = DEFAULT_CHAIN_ID,
  slippage?: number
): Promise<QuoteResponse> {
  const body: Record<string, unknown> = {
    type: "EXACT_INPUT",
    swapper,
    tokenIn,
    tokenOut,
    amount,
    chainId,
  };

  if (slippage !== undefined) {
    body.slippage = { tolerance: slippage };
  }

  if (REFERRAL_ADDRESS) {
    body.portionBips = 15;
    body.portionRecipient = REFERRAL_ADDRESS;
  }

  return uniswapFetch<QuoteResponse>("/quote", body);
}

export async function getSwap(
  quote: QuoteResponse
): Promise<SwapResponse> {
  const { permitData, ...rest } = quote;
  const body: Record<string, unknown> = { ...rest };

  if (permitData !== null && permitData !== undefined) {
    body.permitData = permitData;
  }

  return uniswapFetch<SwapResponse>("/swap", body);
}

// Common token addresses
export const TOKENS = {
  ETH: "0x0000000000000000000000000000000000000000",
  WETH_MAINNET: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC_MAINNET: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WETH_BASE: "0x4200000000000000000000000000000000000006",
  USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH_BASE_SEPOLIA: "0x4200000000000000000000000000000000000006",
} as const;

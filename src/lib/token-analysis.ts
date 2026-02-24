import { createPublicClient, http, getAddress, isAddress, parseAbi } from "viem";
import { base } from "viem/chains";

const ALCHEMY_BASE_RPC = process.env.ALCHEMY_BASE_RPC ?? "https://mainnet.base.org";
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? "";
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY ?? "";

const client = createPublicClient({
  chain: base,
  transport: http(ALCHEMY_BASE_RPC),
});

const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
]);

export interface TokenSafetyChecks {
  honeypotCheck: boolean | null;    // null = unknown
  rugPullRisk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  verifiedSourceCode: boolean | null;
  proxyContract: boolean | null;
  ownershipRenounced: boolean | null;
  hasAudit: boolean | null;
}

export interface TokenHolder {
  address: string;
  percentage: number;
}

export interface TokenAnalysis {
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  safetyChecks: TokenSafetyChecks;
  topHolders: TokenHolder[];
  tvl: number | null;
  volume24h: number | null;
  marketCap: number | null;
  trend7d: number | null;
}

// Check if contract source is verified on Basescan
async function isSourceVerified(address: string): Promise<boolean | null> {
  if (!BASESCAN_API_KEY) return null;
  try {
    const url = `https://api.basescan.org/api?module=contract&action=getabi&address=${address}&apikey=${BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string; result: string };
    return data.status === "1" && data.result !== "Contract source code not verified";
  } catch { return null; }
}

// Check if contract is a proxy
async function isProxy(address: string): Promise<boolean | null> {
  if (!BASESCAN_API_KEY) return null;
  try {
    const url = `https://api.basescan.org/api?module=contract&action=getabi&address=${address}&apikey=${BASESCAN_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json() as { status: string; result: string };
    if (data.status === "1") {
      const abiStr = data.result.toLowerCase();
      return abiStr.includes("upgradeto") || abiStr.includes("implementation");
    }
  } catch { /* ignore */ }
  return null;
}

// Check ownership
async function checkOwnership(address: string): Promise<boolean | null> {
  try {
    const owner = await client.readContract({
      address: address as `0x${string}`,
      abi: erc20Abi,
      functionName: "owner",
    });
    // Renounced = owner is zero address or dead address
    return owner === "0x0000000000000000000000000000000000000000" ||
           owner === "0x000000000000000000000000000000000000dEaD";
  } catch {
    // No owner function = likely no centralized owner
    return null;
  }
}

// Get top holders via Alchemy
async function getTopHolders(address: string): Promise<TokenHolder[]> {
  if (!ALCHEMY_API_KEY) return [];
  try {
    const url = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getTokenBalances",
        params: [address],
      }),
    });
    // Alchemy doesn't directly give top holders, so we return empty for now
    // This would need a different data source (e.g. Dune, Moralis)
    void res;
  } catch { /* ignore */ }
  return [];
}

export async function analyzeToken(rawAddress: string): Promise<TokenAnalysis | null> {
  if (!isAddress(rawAddress)) return null;
  const address = getAddress(rawAddress) as `0x${string}`;

  // Check if it's actually a contract
  const code = await client.getCode({ address });
  if (!code || code === "0x" || code.length <= 2) return null;

  // Parallel queries
  const [nameResult, symbolResult, decimalsResult, supplyResult, verified, proxy, renounced, holders] =
    await Promise.allSettled([
      client.readContract({ address, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
      client.readContract({ address, abi: erc20Abi, functionName: "totalSupply" }),
      isSourceVerified(rawAddress),
      isProxy(rawAddress),
      checkOwnership(rawAddress),
      getTopHolders(rawAddress),
    ]);

  const name = nameResult.status === "fulfilled" ? nameResult.value : null;
  const symbol = symbolResult.status === "fulfilled" ? symbolResult.value : null;
  const decimals = decimalsResult.status === "fulfilled" ? Number(decimalsResult.value) : null;
  const totalSupply = supplyResult.status === "fulfilled" ? supplyResult.value.toString() : null;
  const isVerified = verified.status === "fulfilled" ? verified.value : null;
  const isProxyContract = proxy.status === "fulfilled" ? proxy.value : null;
  const isRenounced = renounced.status === "fulfilled" ? renounced.value : null;
  const topHolders = holders.status === "fulfilled" ? holders.value : [];

  // If it doesn't have name/symbol, it's probably not a token
  if (!name && !symbol) return null;

  // Determine rug pull risk
  let rugPullRisk: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN" = "UNKNOWN";
  if (isVerified && isRenounced) rugPullRisk = "LOW";
  else if (isVerified && !isRenounced) rugPullRisk = "MEDIUM";
  else if (!isVerified) rugPullRisk = "HIGH";

  return {
    name: name ?? null,
    symbol: symbol ?? null,
    decimals,
    totalSupply,
    safetyChecks: {
      honeypotCheck: null, // Would need simulation or GoPlus
      rugPullRisk,
      verifiedSourceCode: isVerified,
      proxyContract: isProxyContract,
      ownershipRenounced: isRenounced,
      hasAudit: null, // Would need audit database
    },
    topHolders,
    tvl: null,       // Would need DeFiLlama
    volume24h: null,  // Would need DEX aggregator
    marketCap: null,  // Would need price feed
    trend7d: null,    // Would need historical data
  };
}

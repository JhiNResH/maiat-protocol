/**
 * Market data aggregator - fetches from DEXScreener, DeFiLlama, CoinGecko
 */

export interface MarketData {
  price?: number
  priceChange24h?: number
  marketCap?: number
  fdv?: number
  volume24h?: number
  liquidity?: number
  tvl?: number
  holders?: number
  contractVerified?: boolean
  audited?: boolean
  auditLinks?: string[]
  chain?: string
  dexUrl?: string
}

// DEXScreener - price, volume, liquidity (free, no key needed)
async function fetchDEXScreener(address: string): Promise<Partial<MarketData>> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      next: { revalidate: 300 }, // cache 5 min
    })
    if (!res.ok) return {}
    const data = await res.json()
    const pair = data.pairs?.[0]
    if (!pair) return {}
    return {
      price: parseFloat(pair.priceUsd || '0'),
      priceChange24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      liquidity: pair.liquidity?.usd || 0,
      fdv: pair.fdv || 0,
      chain: pair.chainId,
      dexUrl: pair.url,
    }
  } catch { return {} }
}

// DeFiLlama - TVL + audit status (free, no key)
async function fetchDeFiLlama(name: string): Promise<Partial<MarketData>> {
  try {
    const res = await fetch('https://api.llama.fi/protocols', {
      next: { revalidate: 3600 }, // cache 1 hour
    })
    if (!res.ok) return {}
    const protocols = await res.json()
    
    // Fuzzy match by name
    const nameLC = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const match = protocols.find((p: any) => {
      const pName = (p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      return pName === nameLC || pName.includes(nameLC) || nameLC.includes(pName)
    })
    
    if (!match) return {}
    return {
      tvl: match.tvl || 0,
      audited: match.audits === '2' || (match.audit_links && match.audit_links.length > 0),
      auditLinks: match.audit_links || [],
    }
  } catch { return {} }
}

// CoinGecko - market cap (free tier, rate limited)
async function fetchCoinGecko(address: string): Promise<Partial<MarketData>> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/base/contract/${address}`,
      { next: { revalidate: 600 } } // cache 10 min
    )
    if (!res.ok) return {}
    const data = await res.json()
    return {
      marketCap: data.market_data?.market_cap?.usd || 0,
      fdv: data.market_data?.fully_diluted_valuation?.usd || 0,
      holders: data.community_data?.twitter_followers || 0,
    }
  } catch { return {} }
}

/**
 * Fetch all market data for a project
 */
export async function getMarketData(
  name: string,
  address: string,
  category: string
): Promise<MarketData> {
  const isRealAddress = address.startsWith('0x') && address.length === 42

  // Fetch in parallel
  const [dex, llama, gecko] = await Promise.all([
    isRealAddress ? fetchDEXScreener(address) : Promise.resolve({} as Partial<MarketData>),
    category === 'm/defi' ? fetchDeFiLlama(name) : Promise.resolve({} as Partial<MarketData>),
    isRealAddress ? fetchCoinGecko(address).catch(() => ({} as Partial<MarketData>)) : Promise.resolve({} as Partial<MarketData>),
  ])

  return {
    ...dex,
    ...llama,
    ...gecko,
    // DEXScreener data takes priority for price/volume
    price: (dex as any).price || (gecko as any).price,
    volume24h: (dex as any).volume24h,
    liquidity: (dex as any).liquidity,
    marketCap: (gecko as any).marketCap || (dex as any).marketCap,
  } as MarketData
}

/**
 * Format number with suffix (1.2M, 3.4B, etc.)
 */
export function formatNumber(num: number | undefined): string {
  if (!num || num === 0) return '—'
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`
  if (num < 0.01) return `$${num.toFixed(6)}`
  return `$${num.toFixed(2)}`
}

export function formatPrice(num: number | undefined): string {
  if (!num || num === 0) return '—'
  if (num < 0.0001) return `$${num.toFixed(8)}`
  if (num < 0.01) return `$${num.toFixed(6)}`
  if (num < 1) return `$${num.toFixed(4)}`
  return `$${num.toFixed(2)}`
}

/**
 * CoinGecko + DeFiLlama API for auto-discovering crypto projects
 */

export interface ExternalProjectData {
  name: string
  symbol?: string
  description?: string
  image?: string
  website?: string
  category: 'm/ai-agents' | 'm/defi'
  address?: string // real contract address
  chain?: string
  marketCap?: number
  tvl?: number
  source: 'coingecko' | 'defillama'
}

/**
 * Search CoinGecko for a token/project by name
 */
export async function searchCoinGecko(query: string): Promise<ExternalProjectData | null> {
  try {
    // Step 1: Search for the coin
    const searchRes = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`,
      { headers: { accept: 'application/json' }, next: { revalidate: 3600 } }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    
    const coin = searchData.coins?.[0]
    if (!coin) return null
    
    // Step 2: Get detailed info
    const detailRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
      { headers: { accept: 'application/json' }, next: { revalidate: 3600 } }
    )
    if (!detailRes.ok) {
      // Return basic info from search
      return {
        name: coin.name,
        symbol: coin.symbol,
        image: coin.large || coin.thumb,
        category: 'm/ai-agents', // default
        source: 'coingecko',
      }
    }
    
    const detail = await detailRes.json()
    
    // Extract contract address (prefer Base, then Ethereum, then any)
    const platforms = detail.platforms || {}
    let address = platforms['base'] || platforms['ethereum'] || platforms['binance-smart-chain']
    const chain = platforms['base'] ? 'Base' : platforms['ethereum'] ? 'Ethereum' : platforms['binance-smart-chain'] ? 'BSC' : undefined
    if (!address) {
      // Take first available
      const firstPlatform = Object.entries(platforms).find(([_, addr]) => addr && (addr as string).startsWith('0x'))
      if (firstPlatform) address = firstPlatform[1] as string
    }
    
    // Determine category from CoinGecko categories
    const categories = (detail.categories || []).map((c: string) => c.toLowerCase())
    const isAI = categories.some((c: string) => 
      c.includes('ai') || c.includes('artificial intelligence') || c.includes('agent') || c.includes('virtuals')
    )
    const isDeFi = categories.some((c: string) => 
      c.includes('defi') || c.includes('decentralized finance') || c.includes('lending') || 
      c.includes('dex') || c.includes('yield') || c.includes('liquid staking')
    )
    
    const description = detail.description?.en
      ? detail.description.en.replace(/<[^>]*>/g, '').slice(0, 500)
      : undefined
    
    return {
      name: detail.name,
      symbol: detail.symbol?.toUpperCase(),
      description,
      image: detail.image?.large || detail.image?.small,
      website: detail.links?.homepage?.[0] || undefined,
      category: isAI ? 'm/ai-agents' : isDeFi ? 'm/defi' : 'm/ai-agents',
      address: address || undefined,
      chain,
      marketCap: detail.market_data?.market_cap?.usd,
      source: 'coingecko',
    }
  } catch (err) {
    console.error('[CoinGecko] Search failed:', err)
    return null
  }
}

/**
 * Search DeFiLlama for a DeFi protocol by name
 */
export async function searchDeFiLlama(query: string): Promise<ExternalProjectData | null> {
  try {
    const res = await fetch('https://api.llama.fi/protocols', {
      next: { revalidate: 3600 }
    })
    if (!res.ok) return null
    const protocols: any[] = await res.json()
    
    const q = query.toLowerCase()
    const match = protocols.find(p => 
      p.name?.toLowerCase() === q ||
      p.symbol?.toLowerCase() === q ||
      p.slug?.toLowerCase() === q
    ) || protocols.find(p =>
      p.name?.toLowerCase().includes(q) ||
      p.slug?.toLowerCase().includes(q)
    )
    
    if (!match) return null
    
    return {
      name: match.name,
      symbol: match.symbol,
      description: match.description || undefined,
      image: match.logo || `https://icons.llama.fi/protocols/${match.slug}`,
      website: match.url || undefined,
      category: 'm/defi',
      address: match.address || undefined,
      chain: match.chain || undefined,
      tvl: match.tvl,
      source: 'defillama',
    }
  } catch (err) {
    console.error('[DeFiLlama] Search failed:', err)
    return null
  }
}

/**
 * Search both CoinGecko and DeFiLlama, return best match
 */
export async function searchExternalAPIs(query: string): Promise<ExternalProjectData | null> {
  const [cgResult, dlResult] = await Promise.allSettled([
    searchCoinGecko(query),
    searchDeFiLlama(query),
  ])
  
  const cg = cgResult.status === 'fulfilled' ? cgResult.value : null
  const dl = dlResult.status === 'fulfilled' ? dlResult.value : null
  
  // If DeFiLlama has a match with TVL, prefer it for DeFi categorization
  if (dl && dl.tvl && dl.tvl > 0) {
    // Merge CoinGecko data if available (for contract address, image)
    if (cg) {
      return {
        ...dl,
        address: dl.address || cg.address,
        image: dl.image || cg.image,
        description: dl.description || cg.description,
        marketCap: cg.marketCap,
      }
    }
    return dl
  }
  
  // Otherwise prefer CoinGecko
  if (cg) {
    if (dl) {
      return { ...cg, tvl: dl.tvl, category: dl.tvl ? 'm/defi' : cg.category }
    }
    return cg
  }
  
  return dl
}

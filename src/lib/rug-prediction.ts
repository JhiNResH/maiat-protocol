/**
 * Wadjet Rug Prediction Engine — Phase D MVP
 *
 * Rule-based rug probability scoring.
 * Uses available signals to compute rug risk without ML (upgradeable to XGBoost later).
 *
 * Score: 0 = safe, 100 = definite rug
 */

export interface RugPrediction {
  rugScore: number           // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  confidence: number         // 0-1 (how confident we are in this prediction)
  signals: RugSignal[]       // contributing factors
  summary: string            // human-readable summary
  predictedAt: string
}

export interface RugSignal {
  name: string
  weight: number             // contribution to rug score (positive = risky)
  value: string              // human-readable value
  severity: 'info' | 'warning' | 'danger'
}

interface AgentData {
  trustScore: number
  completionRate: number
  totalJobs: number
  rawMetrics: Record<string, unknown>
}

// ─── DexScreener Types ────────────────────────────────────────────────────────

export interface DexScreenerPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: { address: string; name: string; symbol: string }
  quoteToken: { address: string; name: string; symbol: string }
  priceNative: string
  priceUsd: string
  txns: { h24: { buys: number; sells: number }; h6: { buys: number; sells: number }; h1: { buys: number; sells: number } }
  volume: { h24: number; h6: number; h1: number }
  priceChange: { h24: number; h6: number; h1: number }
  liquidity: { usd: number; base: number; quote: number }
  fdv: number
  marketCap: number
  pairCreatedAt: number
  info?: { imageUrl?: string; websites?: { url: string }[] }
}

/**
 * Fetch token pairs from DexScreener API (Base chain).
 */
export async function fetchDexScreenerData(tokenAddress: string): Promise<DexScreenerPair[]> {
  const url = `https://api.dexscreener.com/tokens/v1/base/${tokenAddress}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return []
  const data = await res.json() as DexScreenerPair[]
  return Array.isArray(data) ? data : []
}

/**
 * Compute rug prediction for any token using DexScreener data (no DB needed).
 */
export function predictTokenRug(pairs: DexScreenerPair[]): RugPrediction {
  const signals: RugSignal[] = []
  let rugScore = 0
  let maxPossible = 0

  if (pairs.length === 0) {
    return {
      rugScore: 50,
      riskLevel: 'high',
      confidence: 0.1,
      signals: [{ name: 'No DEX Data', weight: 50, value: 'Token not found on any DEX', severity: 'danger' }],
      summary: 'No trading data found. Token may not be listed or may have been rugged.',
      predictedAt: new Date().toISOString(),
    }
  }

  // Use the highest-liquidity pair as primary
  const primary = pairs.reduce((best, p) => (p.liquidity?.usd ?? 0) > (best.liquidity?.usd ?? 0) ? p : best, pairs[0])
  const totalLiquidity = pairs.reduce((sum, p) => sum + (p.liquidity?.usd ?? 0), 0)
  const totalVolume24h = pairs.reduce((sum, p) => sum + (p.volume?.h24 ?? 0), 0)

  // ─── Signal 1: Price Change 24h ───────────────────────────────────────
  maxPossible += 20
  const change24h = primary.priceChange?.h24 ?? 0
  if (change24h <= -50) {
    rugScore += 20
    signals.push({ name: 'Severe Price Crash', weight: 20, value: `${change24h.toFixed(1)}% (24h)`, severity: 'danger' })
  } else if (change24h <= -30) {
    rugScore += 14
    signals.push({ name: 'Major Price Drop', weight: 14, value: `${change24h.toFixed(1)}% (24h)`, severity: 'danger' })
  } else if (change24h <= -15) {
    rugScore += 7
    signals.push({ name: 'Price Declining', weight: 7, value: `${change24h.toFixed(1)}% (24h)`, severity: 'warning' })
  }

  // ─── Signal 2: Liquidity ──────────────────────────────────────────────
  maxPossible += 20
  if (totalLiquidity === 0) {
    rugScore += 20
    signals.push({ name: 'Zero Liquidity', weight: 20, value: '$0', severity: 'danger' })
  } else if (totalLiquidity < 1_000) {
    rugScore += 16
    signals.push({ name: 'Extremely Low Liquidity', weight: 16, value: `$${totalLiquidity.toFixed(0)}`, severity: 'danger' })
  } else if (totalLiquidity < 10_000) {
    rugScore += 8
    signals.push({ name: 'Low Liquidity', weight: 8, value: `$${totalLiquidity.toFixed(0)}`, severity: 'warning' })
  } else if (totalLiquidity < 50_000) {
    rugScore += 3
    signals.push({ name: 'Moderate Liquidity', weight: 3, value: `$${totalLiquidity.toFixed(0)}`, severity: 'info' })
  }

  // ─── Signal 3: Token Age ──────────────────────────────────────────────
  maxPossible += 15
  const createdAt = primary.pairCreatedAt
  if (createdAt) {
    const ageMs = Date.now() - createdAt
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    if (ageDays < 1) {
      rugScore += 15
      signals.push({ name: 'Brand New Token', weight: 15, value: `${(ageMs / 3600000).toFixed(1)} hours old`, severity: 'danger' })
    } else if (ageDays < 7) {
      rugScore += 10
      signals.push({ name: 'Very New Token', weight: 10, value: `${ageDays.toFixed(0)} days old`, severity: 'warning' })
    } else if (ageDays < 30) {
      rugScore += 4
      signals.push({ name: 'New Token', weight: 4, value: `${ageDays.toFixed(0)} days old`, severity: 'info' })
    }
  }

  // ─── Signal 4: Buy/Sell Ratio ─────────────────────────────────────────
  maxPossible += 15
  const buys24h = primary.txns?.h24?.buys ?? 0
  const sells24h = primary.txns?.h24?.sells ?? 0
  const totalTxns = buys24h + sells24h
  if (totalTxns === 0) {
    rugScore += 15
    signals.push({ name: 'Zero Transactions', weight: 15, value: '0 trades in 24h', severity: 'danger' })
  } else if (totalTxns < 10) {
    rugScore += 10
    signals.push({ name: 'Extremely Low Activity', weight: 10, value: `${totalTxns} trades in 24h`, severity: 'warning' })
  } else if (sells24h > 0 && buys24h / sells24h < 0.3) {
    rugScore += 12
    signals.push({ name: 'Heavy Sell Pressure', weight: 12, value: `${buys24h} buys / ${sells24h} sells`, severity: 'danger' })
  } else if (sells24h > 0 && buys24h / sells24h < 0.6) {
    rugScore += 5
    signals.push({ name: 'More Sells Than Buys', weight: 5, value: `${buys24h} buys / ${sells24h} sells`, severity: 'warning' })
  }

  // ─── Signal 5: Volume vs Market Cap ───────────────────────────────────
  maxPossible += 10
  const mcap = primary.marketCap ?? primary.fdv ?? 0
  if (mcap > 0 && totalVolume24h > 0) {
    const volMcapRatio = totalVolume24h / mcap
    if (volMcapRatio > 2) {
      rugScore += 8
      signals.push({ name: 'Abnormally High Volume/MCap', weight: 8, value: `${(volMcapRatio * 100).toFixed(0)}% of mcap`, severity: 'warning' })
    }
  } else if (totalVolume24h === 0) {
    rugScore += 10
    signals.push({ name: 'Zero Volume', weight: 10, value: '$0 in 24h', severity: 'danger' })
  }

  // ─── Signal 6: FDV vs Liquidity ratio ─────────────────────────────────
  maxPossible += 10
  const fdv = primary.fdv ?? 0
  if (fdv > 0 && totalLiquidity > 0) {
    const fdvLiqRatio = fdv / totalLiquidity
    if (fdvLiqRatio > 1000) {
      rugScore += 10
      signals.push({ name: 'Extreme FDV/Liquidity Ratio', weight: 10, value: `${fdvLiqRatio.toFixed(0)}x`, severity: 'danger' })
    } else if (fdvLiqRatio > 100) {
      rugScore += 5
      signals.push({ name: 'High FDV/Liquidity Ratio', weight: 5, value: `${fdvLiqRatio.toFixed(0)}x`, severity: 'warning' })
    }
  }

  // ─── Signal 7: Short-term price crash (1h) ────────────────────────────
  maxPossible += 10
  const change1h = primary.priceChange?.h1 ?? 0
  if (change1h <= -30) {
    rugScore += 10
    signals.push({ name: '1h Flash Crash', weight: 10, value: `${change1h.toFixed(1)}% (1h)`, severity: 'danger' })
  } else if (change1h <= -15) {
    rugScore += 5
    signals.push({ name: '1h Price Drop', weight: 5, value: `${change1h.toFixed(1)}% (1h)`, severity: 'warning' })
  }

  // Clamp
  rugScore = Math.min(rugScore, 100)

  const riskLevel: RugPrediction['riskLevel'] =
    rugScore >= 70 ? 'critical' :
    rugScore >= 45 ? 'high' :
    rugScore >= 20 ? 'medium' : 'low'

  const confidence = maxPossible > 0 ? Math.min(maxPossible / 100, 1) : 0

  const summary = rugScore >= 70
    ? `High probability of rug pull. ${signals.filter(s => s.severity === 'danger').length} critical risk factors detected.`
    : rugScore >= 45
    ? `Elevated risk. Multiple warning signals present. Proceed with extreme caution.`
    : rugScore >= 20
    ? `Moderate risk. Some concerning signals but not conclusive. DYOR.`
    : `Low risk based on available data. Always DYOR.`

  return {
    rugScore,
    riskLevel,
    confidence: Math.round(confidence * 100) / 100,
    signals: signals.sort((a, b) => b.weight - a.weight),
    summary,
    predictedAt: new Date().toISOString(),
  }
}

/**
 * DexScreener pair data structure (from tokens/v1/base/{address} endpoint)
 */
export interface DexScreenerPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  quoteToken: {
    address: string
    name: string
    symbol: string
  }
  priceNative: string
  priceUsd: string
  txns: {
    m5: { buys: number; sells: number }
    h1: { buys: number; sells: number }
    h6: { buys: number; sells: number }
    h24: { buys: number; sells: number }
  }
  volume: {
    m5: number
    h1: number
    h6: number
    h24: number
  }
  priceChange: {
    m5: number
    h1: number
    h6: number
    h24: number
  }
  liquidity: {
    usd: number
    base: number
    quote: number
  }
  fdv: number
  marketCap: number
  pairCreatedAt: number // Unix timestamp in ms
  info?: {
    imageUrl?: string
    websites?: { label: string; url: string }[]
    socials?: { type: string; url: string }[]
  }
}

export interface DexScreenerTokenData {
  pairs: DexScreenerPair[] | null
}

/**
 * Compute rug probability for an agent based on all available signals.
 */
export function predictRug(agent: AgentData): RugPrediction {
  const signals: RugSignal[] = []
  let rugScore = 0
  let maxPossible = 0  // for confidence calculation

  const raw = agent.rawMetrics || {}
  const priceData = raw.priceData as Record<string, number> | undefined
  const healthSignals = raw.healthSignals as Record<string, unknown> | undefined
  const successRate = raw.successRate as number | undefined

  // ─── Signal 1: Trust Score (inverse) ────────────────────────────────────
  // Low trust = higher rug risk
  maxPossible += 20
  if (agent.trustScore < 20) {
    rugScore += 20
    signals.push({ name: 'Very Low Trust Score', weight: 20, value: `${agent.trustScore}/100`, severity: 'danger' })
  } else if (agent.trustScore < 40) {
    rugScore += 12
    signals.push({ name: 'Low Trust Score', weight: 12, value: `${agent.trustScore}/100`, severity: 'warning' })
  } else if (agent.trustScore < 60) {
    rugScore += 5
    signals.push({ name: 'Moderate Trust Score', weight: 5, value: `${agent.trustScore}/100`, severity: 'info' })
  }

  // ─── Signal 2: No Jobs / Very Low Activity ──────────────────────────────
  maxPossible += 15
  if (agent.totalJobs === 0) {
    rugScore += 15
    signals.push({ name: 'Zero Jobs Completed', weight: 15, value: '0 jobs', severity: 'danger' })
  } else if (agent.totalJobs < 5) {
    rugScore += 8
    signals.push({ name: 'Very Low Activity', weight: 8, value: `${agent.totalJobs} jobs`, severity: 'warning' })
  }

  // ─── Signal 3: Low Completion Rate ──────────────────────────────────────
  maxPossible += 15
  if (agent.completionRate < 0.3) {
    rugScore += 15
    signals.push({ name: 'Very Low Completion Rate', weight: 15, value: `${(agent.completionRate * 100).toFixed(0)}%`, severity: 'danger' })
  } else if (agent.completionRate < 0.6) {
    rugScore += 8
    signals.push({ name: 'Low Completion Rate', weight: 8, value: `${(agent.completionRate * 100).toFixed(0)}%`, severity: 'warning' })
  }

  // ─── Signal 4: Price Crash ──────────────────────────────────────────────
  maxPossible += 20
  if (priceData) {
    const change24h = priceData.priceChange24h ?? 0
    if (change24h <= -50) {
      rugScore += 20
      signals.push({ name: 'Severe Price Crash', weight: 20, value: `${change24h.toFixed(1)}% (24h)`, severity: 'danger' })
    } else if (change24h <= -30) {
      rugScore += 14
      signals.push({ name: 'Major Price Drop', weight: 14, value: `${change24h.toFixed(1)}% (24h)`, severity: 'danger' })
    } else if (change24h <= -15) {
      rugScore += 7
      signals.push({ name: 'Price Declining', weight: 7, value: `${change24h.toFixed(1)}% (24h)`, severity: 'warning' })
    }
  }

  // ─── Signal 5: Low/No Liquidity ─────────────────────────────────────────
  maxPossible += 15
  if (priceData) {
    const liq = priceData.liquidity ?? 0
    if (liq === 0) {
      rugScore += 15
      signals.push({ name: 'Zero Liquidity', weight: 15, value: '$0', severity: 'danger' })
    } else if (liq < 1000) {
      rugScore += 12
      signals.push({ name: 'Extremely Low Liquidity', weight: 12, value: `$${liq.toFixed(0)}`, severity: 'danger' })
    } else if (liq < 10000) {
      rugScore += 5
      signals.push({ name: 'Low Liquidity', weight: 5, value: `$${liq.toFixed(0)}`, severity: 'warning' })
    }
  }

  // ─── Signal 6: LP Drain (from Wadjet health signals) ────────────────────
  maxPossible += 10
  if (healthSignals) {
    const lpDrainRate = healthSignals.lpDrainRate as number | undefined
    if (typeof lpDrainRate === 'number' && lpDrainRate <= -0.3) {
      rugScore += 10
      signals.push({ name: 'Liquidity Being Drained', weight: 10, value: `${(lpDrainRate * 100).toFixed(0)}% removed`, severity: 'danger' })
    } else if (typeof lpDrainRate === 'number' && lpDrainRate <= -0.15) {
      rugScore += 5
      signals.push({ name: 'Liquidity Decreasing', weight: 5, value: `${(lpDrainRate * 100).toFixed(0)}% removed`, severity: 'warning' })
    }
  }

  // ─── Signal 7: Completion Rate Trend (from Wadjet) ──────────────────────
  maxPossible += 10
  if (healthSignals) {
    const trend = healthSignals.completionTrend as string | undefined
    if (trend === 'crashing') {
      rugScore += 10
      signals.push({ name: 'Completion Rate Crashing', weight: 10, value: 'Rapid decline', severity: 'danger' })
    } else if (trend === 'declining') {
      rugScore += 5
      signals.push({ name: 'Completion Rate Declining', weight: 5, value: 'Declining', severity: 'warning' })
    }
  }

  // ─── Signal 8: High Volatility ──────────────────────────────────────────
  maxPossible += 5
  if (healthSignals) {
    const vol = healthSignals.volatility as number | undefined
    if (typeof vol === 'number' && vol > 0.5) {
      rugScore += 5
      signals.push({ name: 'Extreme Volatility', weight: 5, value: `${(vol * 100).toFixed(0)}%`, severity: 'warning' })
    }
  }

  // Clamp and compute risk level
  rugScore = Math.min(rugScore, 100)

  const riskLevel: RugPrediction['riskLevel'] =
    rugScore >= 70 ? 'critical' :
    rugScore >= 45 ? 'high' :
    rugScore >= 20 ? 'medium' : 'low'

  // Confidence: how many signal categories had data available
  const confidence = maxPossible > 0 ? Math.min(maxPossible / 100, 1) : 0

  // Summary
  const summary = rugScore >= 70
    ? `High probability of rug pull. ${signals.filter(s => s.severity === 'danger').length} critical risk factors detected.`
    : rugScore >= 45
    ? `Elevated risk. Multiple warning signals present. Proceed with extreme caution.`
    : rugScore >= 20
    ? `Moderate risk. Some concerning signals but not conclusive.`
    : `Low risk based on available data. Always DYOR.`

  return {
    rugScore,
    riskLevel,
    confidence: Math.round(confidence * 100) / 100,
    signals: signals.sort((a, b) => b.weight - a.weight),
    summary,
    predictedAt: new Date().toISOString(),
  }
}

/**
 * Compute rug probability for a token based on DexScreener data.
 * Pure token analysis without agent behavioral data.
 */
export function predictTokenRugFromData(data: DexScreenerTokenData): RugPrediction {
  const signals: RugSignal[] = []
  let rugScore = 0
  let maxPossible = 0

  const pairs = data.pairs ?? []
  const primaryPair = pairs[0]

  // If no pairs found, this is a major red flag
  if (!primaryPair) {
    return {
      rugScore: 85,
      riskLevel: 'critical',
      confidence: 0.4,
      signals: [
        {
          name: 'No Trading Pairs',
          weight: 85,
          value: 'Token has no liquidity pools',
          severity: 'danger',
        },
      ],
      summary: 'Critical risk: No trading pairs found. Token may be abandoned or a scam.',
      predictedAt: new Date().toISOString(),
    }
  }

  // Aggregate liquidity across all pairs
  const totalLiquidity = pairs.reduce((sum, p) => sum + (p.liquidity?.usd ?? 0), 0)
  const totalVolume24h = pairs.reduce((sum, p) => sum + (p.volume?.h24 ?? 0), 0)
  const totalBuys24h = pairs.reduce((sum, p) => sum + (p.txns?.h24?.buys ?? 0), 0)
  const totalSells24h = pairs.reduce((sum, p) => sum + (p.txns?.h24?.sells ?? 0), 0)

  // Use primary pair for price change (most liquid)
  const priceChange24h = primaryPair.priceChange?.h24 ?? 0
  const priceChange6h = primaryPair.priceChange?.h6 ?? 0
  const fdv = primaryPair.fdv ?? 0
  const marketCap = primaryPair.marketCap ?? fdv

  // Token age (from pairCreatedAt)
  const pairCreatedAt = primaryPair.pairCreatedAt ?? Date.now()
  const tokenAgeHours = (Date.now() - pairCreatedAt) / (1000 * 60 * 60)
  const tokenAgeDays = tokenAgeHours / 24

  // ─── Signal 1: Price Crash ────────────────────────────────────────────────
  maxPossible += 25
  if (priceChange24h <= -70) {
    rugScore += 25
    signals.push({
      name: 'Catastrophic Price Crash',
      weight: 25,
      value: `${priceChange24h.toFixed(1)}% (24h)`,
      severity: 'danger',
    })
  } else if (priceChange24h <= -50) {
    rugScore += 20
    signals.push({
      name: 'Severe Price Crash',
      weight: 20,
      value: `${priceChange24h.toFixed(1)}% (24h)`,
      severity: 'danger',
    })
  } else if (priceChange24h <= -30) {
    rugScore += 12
    signals.push({
      name: 'Major Price Drop',
      weight: 12,
      value: `${priceChange24h.toFixed(1)}% (24h)`,
      severity: 'danger',
    })
  } else if (priceChange24h <= -15) {
    rugScore += 6
    signals.push({
      name: 'Price Declining',
      weight: 6,
      value: `${priceChange24h.toFixed(1)}% (24h)`,
      severity: 'warning',
    })
  }

  // Short-term price crash (6h) — could indicate active rug
  if (priceChange6h <= -40) {
    rugScore += 10
    signals.push({
      name: 'Rapid Price Collapse',
      weight: 10,
      value: `${priceChange6h.toFixed(1)}% (6h)`,
      severity: 'danger',
    })
  }

  // ─── Signal 2: Liquidity ──────────────────────────────────────────────────
  maxPossible += 20
  if (totalLiquidity === 0) {
    rugScore += 20
    signals.push({
      name: 'Zero Liquidity',
      weight: 20,
      value: '$0',
      severity: 'danger',
    })
  } else if (totalLiquidity < 1000) {
    rugScore += 18
    signals.push({
      name: 'Critically Low Liquidity',
      weight: 18,
      value: `$${totalLiquidity.toFixed(0)}`,
      severity: 'danger',
    })
  } else if (totalLiquidity < 5000) {
    rugScore += 12
    signals.push({
      name: 'Very Low Liquidity',
      weight: 12,
      value: `$${totalLiquidity.toFixed(0)}`,
      severity: 'danger',
    })
  } else if (totalLiquidity < 25000) {
    rugScore += 6
    signals.push({
      name: 'Low Liquidity',
      weight: 6,
      value: `$${totalLiquidity.toFixed(0)}`,
      severity: 'warning',
    })
  }

  // ─── Signal 3: Volume to Market Cap Ratio ─────────────────────────────────
  // Healthy tokens have reasonable volume relative to mcap
  // Very low volume = no interest, very high = possible wash trading
  maxPossible += 15
  if (marketCap > 0) {
    const volumeRatio = totalVolume24h / marketCap
    if (volumeRatio < 0.001) {
      rugScore += 12
      signals.push({
        name: 'Dead Volume',
        weight: 12,
        value: `${(volumeRatio * 100).toFixed(3)}% of mcap`,
        severity: 'danger',
      })
    } else if (volumeRatio < 0.01) {
      rugScore += 5
      signals.push({
        name: 'Very Low Trading Activity',
        weight: 5,
        value: `${(volumeRatio * 100).toFixed(2)}% of mcap`,
        severity: 'warning',
      })
    } else if (volumeRatio > 5) {
      // Suspiciously high volume — possible wash trading
      rugScore += 8
      signals.push({
        name: 'Abnormally High Volume',
        weight: 8,
        value: `${(volumeRatio * 100).toFixed(0)}% of mcap`,
        severity: 'warning',
      })
    }
  }

  // ─── Signal 4: Token Age ──────────────────────────────────────────────────
  // Very new tokens are higher risk
  maxPossible += 15
  if (tokenAgeDays < 1) {
    rugScore += 15
    signals.push({
      name: 'Extremely New Token',
      weight: 15,
      value: `${tokenAgeHours.toFixed(1)} hours old`,
      severity: 'danger',
    })
  } else if (tokenAgeDays < 3) {
    rugScore += 10
    signals.push({
      name: 'Very New Token',
      weight: 10,
      value: `${tokenAgeDays.toFixed(1)} days old`,
      severity: 'warning',
    })
  } else if (tokenAgeDays < 7) {
    rugScore += 5
    signals.push({
      name: 'New Token',
      weight: 5,
      value: `${tokenAgeDays.toFixed(0)} days old`,
      severity: 'info',
    })
  }

  // ─── Signal 5: Buy/Sell Imbalance ─────────────────────────────────────────
  // Heavy selling pressure = potential exit by insiders
  maxPossible += 15
  const totalTxns = totalBuys24h + totalSells24h
  if (totalTxns > 10) {
    const sellRatio = totalSells24h / totalTxns
    if (sellRatio > 0.8) {
      rugScore += 15
      signals.push({
        name: 'Extreme Sell Pressure',
        weight: 15,
        value: `${totalSells24h} sells vs ${totalBuys24h} buys`,
        severity: 'danger',
      })
    } else if (sellRatio > 0.65) {
      rugScore += 8
      signals.push({
        name: 'Heavy Sell Pressure',
        weight: 8,
        value: `${totalSells24h} sells vs ${totalBuys24h} buys`,
        severity: 'warning',
      })
    }
  } else if (totalTxns <= 2 && tokenAgeDays > 1) {
    // Very few transactions on a token older than 1 day
    rugScore += 8
    signals.push({
      name: 'Almost No Trading Activity',
      weight: 8,
      value: `${totalTxns} txns in 24h`,
      severity: 'warning',
    })
  }

  // ─── Signal 6: FDV to Liquidity Ratio ─────────────────────────────────────
  // High FDV with low liquidity = potential rug setup
  maxPossible += 10
  if (fdv > 0 && totalLiquidity > 0) {
    const fdvLiqRatio = fdv / totalLiquidity
    if (fdvLiqRatio > 100) {
      rugScore += 10
      signals.push({
        name: 'Extreme FDV/Liquidity Ratio',
        weight: 10,
        value: `${fdvLiqRatio.toFixed(0)}x`,
        severity: 'danger',
      })
    } else if (fdvLiqRatio > 50) {
      rugScore += 5
      signals.push({
        name: 'High FDV/Liquidity Ratio',
        weight: 5,
        value: `${fdvLiqRatio.toFixed(0)}x`,
        severity: 'warning',
      })
    }
  }

  // Clamp and compute risk level
  rugScore = Math.min(rugScore, 100)

  const riskLevel: RugPrediction['riskLevel'] =
    rugScore >= 70 ? 'critical' :
    rugScore >= 45 ? 'high' :
    rugScore >= 20 ? 'medium' : 'low'

  // Confidence based on data availability
  const confidence = maxPossible > 0 ? Math.min(maxPossible / 100, 1) : 0

  // Summary
  const dangerCount = signals.filter(s => s.severity === 'danger').length
  const summary =
    rugScore >= 70
      ? `High probability of rug pull. ${dangerCount} critical risk factors detected.`
      : rugScore >= 45
      ? `Elevated risk. Multiple warning signals present. Proceed with extreme caution.`
      : rugScore >= 20
      ? `Moderate risk. Some concerning signals but not conclusive.`
      : `Low risk based on available market data. Always DYOR.`

  return {
    rugScore,
    riskLevel,
    confidence: Math.round(confidence * 100) / 100,
    signals: signals.sort((a, b) => b.weight - a.weight),
    summary,
    predictedAt: new Date().toISOString(),
  }
}

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

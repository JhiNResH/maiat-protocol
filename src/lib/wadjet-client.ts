/**
 * Wadjet Service Client
 * 
 * Protocol calls Wadjet via its Railway API.
 * All ML/prediction/scanning logic lives in wadjet repo.
 * Protocol is just the API gateway + frontend.
 */

const WADJET_URL = process.env.WADJET_URL ?? 'https://wadjet-production.up.railway.app'
const TIMEOUT = 15_000

async function wadjetFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${WADJET_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT),
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown error')
    throw new Error(`Wadjet ${path} returned ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ─── Rug Prediction (Token) ─────────────────────────────────────────────────

export interface WadjetPrediction {
  rugScore: number
  riskLevel: string
  confidence: number
  signals: Array<{ name: string; weight: number; value: string; severity: string }>
  summary: string
}

export interface WadjetTokenResult {
  token_address: string
  name?: string
  symbol?: string
  rug_probability: number
  risk_level: string
  confidence: number
  features?: Record<string, unknown>
  signals?: Array<{ name: string; weight: number; value: string; severity: string }>
}

export async function predictToken(tokenAddress: string): Promise<WadjetTokenResult> {
  return wadjetFetch<WadjetTokenResult>('/predict', {
    method: 'POST',
    body: JSON.stringify({ token_address: tokenAddress }),
  })
}

// ─── Agent Trust (Rug Prediction for Agent) ─────────────────────────────────

export interface WadjetAgentResult {
  address: string
  name?: string
  trust_score?: number
  rug_probability: number
  risk_level: string
  confidence: number
  behavioral_signals?: Record<string, unknown>
  features?: Record<string, unknown>
}

export async function predictAgent(address: string, tokenAddress?: string | null): Promise<WadjetAgentResult> {
  return wadjetFetch<WadjetAgentResult>('/predict/agent', {
    method: 'POST',
    body: JSON.stringify({ address, token_address: tokenAddress ?? address }),
  })
}

// ─── Wadjet Profile (full agent analysis) ───────────────────────────────────

export interface WadjetProfile {
  address: string
  trust_score: number
  risk_level: string
  rug_probability: number
  behavioral_profile?: Record<string, unknown>
  scenarios?: unknown[]
}

export async function getProfile(address: string): Promise<WadjetProfile> {
  return wadjetFetch<WadjetProfile>(`/wadjet/${address}`)
}

// ─── Sentinel Alerts ────────────────────────────────────────────────────────

export interface WadjetAlert {
  token_address: string
  alert_type: string
  severity: string
  message: string
  timestamp: string
  data?: Record<string, unknown>
}

export async function getAlerts(): Promise<WadjetAlert[]> {
  return wadjetFetch<WadjetAlert[]>('/sentinel/alerts')
}

export async function getAlertsByToken(tokenAddress: string): Promise<WadjetAlert[]> {
  return wadjetFetch<WadjetAlert[]>(`/sentinel/alerts/${tokenAddress}`)
}

// ─── Risks ──────────────────────────────────────────────────────────────────

export interface RiskSummary {
  total_monitored: number
  high_risk_count: number
  critical_count: number
  average_rug_probability: number
}

export async function getRiskSummary(): Promise<RiskSummary> {
  return wadjetFetch<RiskSummary>('/risks/summary')
}

export async function getTopRisks(limit = 20): Promise<unknown[]> {
  return wadjetFetch<unknown[]>(`/risks/top?limit=${limit}`)
}

// ─── Cron Triggers ──────────────────────────────────────────────────────────

export async function triggerDailyCron(): Promise<unknown> {
  return wadjetFetch('/cron/run-daily', { method: 'POST' })
}

export async function triggerScan(tokenAddress: string): Promise<unknown> {
  return wadjetFetch('/sentinel/scan', {
    method: 'POST',
    body: JSON.stringify({ token_address: tokenAddress }),
  })
}

// ─── Feedback Loop (Protocol → Wadjet) ──────────────────────────────────────

export interface OutcomeFeedbackItem {
  agent_address: string
  outcome: string // success | failure | partial | expired
  trust_score_at_check?: number
  new_trust_score?: number
  job_id?: string
  token_address?: string
  actual_amount_out?: string
  recorded_at?: string
}

export interface FeedbackResult {
  stored: number
  errors: number
  source: string
  message: string
}

/**
 * Push a single outcome to Wadjet for retraining pipeline.
 * Called after POST /api/v1/outcome records a result.
 * Fire-and-forget — failure here should not block the outcome API.
 */
export async function pushOutcome(item: OutcomeFeedbackItem): Promise<FeedbackResult | null> {
  try {
    return await wadjetFetch<FeedbackResult>('/feedback/outcomes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Api-Key': process.env.WADJET_CRON_KEY ?? '',
      },
      body: JSON.stringify({
        outcomes: [item],
        source: 'maiat-protocol',
      }),
    })
  } catch (err) {
    console.warn('[wadjet-client] pushOutcome failed (non-blocking):', err)
    return null
  }
}

/**
 * Push a batch of outcomes to Wadjet.
 * Used by cron to flush accumulated outcomes.
 */
export async function pushOutcomeBatch(items: OutcomeFeedbackItem[]): Promise<FeedbackResult | null> {
  if (items.length === 0) return null
  try {
    return await wadjetFetch<FeedbackResult>('/feedback/outcomes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Api-Key': process.env.WADJET_CRON_KEY ?? '',
      },
      body: JSON.stringify({
        outcomes: items,
        source: 'maiat-protocol',
      }),
    })
  } catch (err) {
    console.warn('[wadjet-client] pushOutcomeBatch failed (non-blocking):', err)
    return null
  }
}

// ─── Health ─────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string }> {
  return wadjetFetch<{ status: string }>('/health')
}

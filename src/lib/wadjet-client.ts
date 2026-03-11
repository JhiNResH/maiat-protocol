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

export async function predictAgent(address: string): Promise<WadjetAgentResult> {
  return wadjetFetch<WadjetAgentResult>('/predict/agent', {
    method: 'POST',
    body: JSON.stringify({ address }),
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

// ─── Health ─────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ status: string }> {
  return wadjetFetch<{ status: string }>('/health')
}

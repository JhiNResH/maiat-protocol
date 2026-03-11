/**
 * Wadjet Active Scan — Proactive trust monitoring
 * 
 * Scans all indexed agents, detects trust degradation,
 * flags high-risk tokens, and generates alerts.
 */

import { PrismaClient } from '@prisma/client'
import { predictRug, fetchDexScreenerData, predictTokenRug } from './rug-prediction'

const prisma = new PrismaClient()

export interface ScanResult {
  agentsScanned: number
  tokensScanned: number
  alertsCreated: number
  alerts: AlertSummary[]
}

interface AlertSummary {
  target: string
  name: string | null
  type: string
  severity: string
  title: string
  summary: string
}

// Thresholds
const TRUST_DROP_THRESHOLD = 15    // score drop >= 15 triggers alert
const RUG_SCORE_THRESHOLD = 45     // rug score >= 45 triggers alert
const CRITICAL_RUG_THRESHOLD = 70  // rug score >= 70 is critical

/**
 * Run full Wadjet active scan.
 * 1. Re-score all agents with tokens → detect trust degradation
 * 2. Check token rug risk via DexScreener → flag high risk
 */
export async function runWadjetScan(verbose = false): Promise<ScanResult> {
  const log = verbose ? console.log : () => {}
  const alerts: AlertSummary[] = []
  let tokensScanned = 0

  // ─── Phase 1: Scan all agents ─────────────────────────────────────────
  const agents = await prisma.agentScore.findMany({
    select: {
      id: true,
      walletAddress: true,
      trustScore: true,
      completionRate: true,
      totalJobs: true,
      tokenAddress: true,
      tokenSymbol: true,
      rawMetrics: true,
    },
  })

  log(`[Wadjet] Scanning ${agents.length} agents...`)

  for (const agent of agents) {
    const raw = (agent.rawMetrics ?? {}) as Record<string, unknown>
    const name = (typeof raw.name === 'string' ? raw.name : null) ?? agent.tokenSymbol

    // Re-run rug prediction with current data
    const prediction = predictRug({
      trustScore: agent.trustScore,
      completionRate: agent.completionRate,
      totalJobs: agent.totalJobs,
      rawMetrics: raw,
    })

    // Check if agent has a token → scan it on DexScreener
    if (agent.tokenAddress) {
      tokensScanned++
      try {
        const pairs = await fetchDexScreenerData(agent.tokenAddress)
        if (pairs.length > 0) {
          const tokenPrediction = predictTokenRug(pairs)

          if (tokenPrediction.rugScore >= RUG_SCORE_THRESHOLD) {
            const severity = tokenPrediction.rugScore >= CRITICAL_RUG_THRESHOLD ? 'critical' : 'high'
            const alert: AlertSummary = {
              target: agent.tokenAddress,
              name: name ?? agent.tokenSymbol,
              type: 'rug_risk',
              severity,
              title: `${severity === 'critical' ? '🚨' : '⚠️'} Rug risk detected: ${name ?? agent.tokenSymbol ?? agent.tokenAddress.slice(0, 10)}`,
              summary: tokenPrediction.summary,
            }
            alerts.push(alert)

            // Persist alert
            await prisma.wadjetAlert.create({
              data: {
                target: agent.tokenAddress,
                targetType: 'token',
                alertType: 'rug_risk',
                severity,
                title: alert.title,
                summary: tokenPrediction.summary,
                currentScore: tokenPrediction.rugScore,
                metadata: {
                  signals: tokenPrediction.signals,
                  confidence: tokenPrediction.confidence,
                  agentWallet: agent.walletAddress,
                  tokenSymbol: agent.tokenSymbol,
                },
              },
            })

            log(`  [ALERT] ${alert.title}`)
          }
        }

        // Rate limit DexScreener
        await new Promise(r => setTimeout(r, 200))
      } catch (e) {
        log(`  [WARN] DexScreener failed for ${agent.tokenAddress}: ${(e as Error).message}`)
      }
    }

    // Check trust degradation (compare current prediction vs stored score)
    if (prediction.rugScore >= RUG_SCORE_THRESHOLD && agent.trustScore < 50) {
      const alert: AlertSummary = {
        target: agent.walletAddress,
        name,
        type: 'trust_degradation',
        severity: prediction.rugScore >= CRITICAL_RUG_THRESHOLD ? 'critical' : 'high',
        title: `📉 Trust degradation: ${name ?? agent.walletAddress.slice(0, 10)} (score: ${agent.trustScore})`,
        summary: prediction.summary,
      }
      alerts.push(alert)

      await prisma.wadjetAlert.create({
        data: {
          target: agent.walletAddress,
          targetType: 'agent',
          alertType: 'trust_degradation',
          severity: alert.severity,
          title: alert.title,
          summary: prediction.summary,
          currentScore: agent.trustScore,
          metadata: {
            rugScore: prediction.rugScore,
            signals: prediction.signals,
            completionRate: agent.completionRate,
            totalJobs: agent.totalJobs,
          },
        },
      })

      log(`  [ALERT] ${alert.title}`)
    }
  }

  log(`[Wadjet] Scan complete: ${agents.length} agents, ${tokensScanned} tokens, ${alerts.length} alerts`)

  return {
    agentsScanned: agents.length,
    tokensScanned,
    alertsCreated: alerts.length,
    alerts,
  }
}

/**
 * Get recent Wadjet alerts.
 */
export async function getRecentAlerts(limit = 20, unresolvedOnly = true) {
  return prisma.wadjetAlert.findMany({
    where: unresolvedOnly ? { resolved: false } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/**
 * Get alert stats for dashboard.
 */
export async function getAlertStats() {
  const [total, unresolved, critical, high] = await Promise.all([
    prisma.wadjetAlert.count(),
    prisma.wadjetAlert.count({ where: { resolved: false } }),
    prisma.wadjetAlert.count({ where: { severity: 'critical', resolved: false } }),
    prisma.wadjetAlert.count({ where: { severity: 'high', resolved: false } }),
  ])
  return { total, unresolved, critical, high }
}

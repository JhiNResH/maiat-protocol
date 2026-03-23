import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const WADJET_API_URL = process.env.WADJET_API_URL

  // ─── Try FastAPI first ────────────────────────────────────────────────────
  if (WADJET_API_URL) {
    try {
      const res = await fetch(`${WADJET_API_URL}/wadjet/clusters`, {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ ...data, source: 'ml' }, { headers: CORS })
      }
    } catch {
      // fall through
    }
  }

  // ─── Fallback: top risky agents from DB ───────────────────────────────────
  try {
    const agents = await prisma.agentScore.findMany({
      where: { trustScore: { lt: 40 } },
      orderBy: { trustScore: 'asc' },
      take: 50,
      select: {
        walletAddress: true, trustScore: true, completionRate: true,
        totalJobs: true, tokenSymbol: true, rawMetrics: true,
      },
    })

    // Simple cluster: group by trust score buckets
    const clusters = [
      {
        id: 'cluster-critical',
        label: 'Critical Risk Cluster',
        riskLevel: 'critical',
        members: agents
          .filter(a => a.trustScore < 20)
          .map(a => ({
            address: a.walletAddress,
            name: ((a.rawMetrics as Record<string, unknown>)?.name as string) || a.tokenSymbol || a.walletAddress.slice(0, 8),
            trustScore: a.trustScore,
          })),
      },
      {
        id: 'cluster-high',
        label: 'High Risk Cluster',
        riskLevel: 'high',
        members: agents
          .filter(a => a.trustScore >= 20 && a.trustScore < 40)
          .map(a => ({
            address: a.walletAddress,
            name: ((a.rawMetrics as Record<string, unknown>)?.name as string) || a.tokenSymbol || a.walletAddress.slice(0, 8),
            trustScore: a.trustScore,
          })),
      },
    ].filter(c => c.members.length > 0)

    return NextResponse.json(
      { clusters, source: 'rule-based' },
      { status: 200, headers: CORS }
    )
  } catch (err) {
    console.error('[Wadjet Clusters API]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}

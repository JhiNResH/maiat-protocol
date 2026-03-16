'use client'

import React, { Suspense, useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  ChevronDown, Clock, Activity,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent {
  address: string
  trustScore: number
  riskPrediction: {
    '7_days': number
    '30_days': number
    '90_days': number
    confidence: number
  }
  categories: {
    smart_contract: number
    market_volatility: number
    operational: number
    regulatory: number
  }
  updated_at: string
}

interface Heatmap {
  heatmap: Array<Array<string | number>>
  agents: string[]
}

interface Rankings {
  safest: Array<{ agent: string; score: number; rank: number }>
  riskiest: Array<{ agent: string; score: number; rank: number }>
  improving: Array<{ agent: string; score: number; change: number; rank: number }>
  deteriorating: Array<{ agent: string; score: number; change: number; rank: number }>
}

// ─── Component ────────────────────────────────────────────────────────────────

function WadjetDashboard() {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d')
  const [agents, setAgents] = useState<Agent[]>([])
  const [rankings, setRankings] = useState<Rankings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [agentRes, rankRes] = await Promise.all([
          fetch('/api/v1/wadjet/agents'),
          fetch('/api/v1/wadjet/rankings'),
        ])

        if (!agentRes.ok || !rankRes.ok) {
          throw new Error('Failed to fetch Wadjet data')
        }

        const agentData = await agentRes.json()
        const rankData = await rankRes.json()

        setAgents(agentData.agents || [])
        setRankings(rankData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        console.error('[Wadjet Dashboard]', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-[var(--text-muted)] border-t-[var(--text-primary)] rounded-full mx-auto mb-4" />
          <p className="text-[var(--text-muted)] font-mono">Loading Wadjet...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 font-mono mb-2">Error loading dashboard</p>
          <p className="text-[var(--text-muted)] font-mono text-sm">{error}</p>
        </div>
      </div>
    )
  }

  const timeframeKey = (
    timeframe === '7d' ? '7_days' : timeframe === '30d' ? '30_days' : '90_days'
  ) as '7_days' | '30_days' | '90_days'

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Wadjet</h1>
            <p className="text-[var(--text-muted)] font-mono">Predictive Risk Intelligence</p>
          </div>
          {/* Timeframe Selector */}
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-4 py-2 font-mono text-sm rounded border transition-colors ${
                  timeframe === tf
                    ? 'bg-[var(--accent-bg)] text-[var(--accent)] border-[var(--accent)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-8">
        {/* Agent Scores Table */}
        <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden">
          <div className="p-6 border-b border-[var(--border)]">
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Agent Trust Scores
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--bg-page)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-6 py-3 text-left font-mono text-sm text-[var(--text-secondary)]">Agent</th>
                  <th className="px-6 py-3 text-right font-mono text-sm text-[var(--text-secondary)]">Trust Score</th>
                  <th className="px-6 py-3 text-right font-mono text-sm text-[var(--text-secondary)]">Risk Prediction</th>
                  <th className="px-6 py-3 text-right font-mono text-sm text-[var(--text-secondary)]">Confidence</th>
                  <th className="px-6 py-3 text-right font-mono text-sm text-[var(--text-secondary)]">Updated</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)] font-mono text-sm">
                      No agents found
                    </td>
                  </tr>
                ) : (
                  agents.slice(0, 15).map(agent => (
                    <tr
                      key={agent.address}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-page)] transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-sm text-[var(--accent)]">
                        {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-[var(--bg-secondary)] rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                              style={{ width: `${agent.trustScore}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm w-8 text-right">{agent.trustScore}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {agent.riskPrediction[timeframeKey] > 0 ? (
                            <>
                              <TrendingUp className="w-4 h-4 text-red-500" />
                              <span className="text-red-500 font-mono text-sm">
                                +{agent.riskPrediction[timeframeKey]}%
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-4 h-4 text-emerald-500" />
                              <span className="text-emerald-500 font-mono text-sm">
                                {agent.riskPrediction[timeframeKey]}%
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-sm">
                        {agent.riskPrediction.confidence}%
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-[var(--text-muted)]">
                        {new Date(agent.updated_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rankings */}
        {rankings && (
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Safest */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Top Safest
              </h3>
              <div className="space-y-3">
                {rankings.safest.slice(0, 5).map(item => (
                  <div
                    key={item.agent}
                    className="flex items-center justify-between p-3 bg-[var(--bg-page)] rounded border border-[var(--border)] hover:border-emerald-500 transition-colors"
                  >
                    <div>
                      <p className="font-mono text-xs text-[var(--accent)]">
                        #{item.rank}
                      </p>
                      <p className="font-mono text-xs text-[var(--text-muted)]">
                        {item.agent.slice(0, 6)}...{item.agent.slice(-4)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-bold text-emerald-500">{item.score}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Riskiest */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Top Riskiest
              </h3>
              <div className="space-y-3">
                {rankings.riskiest.slice(0, 5).map(item => (
                  <div
                    key={item.agent}
                    className="flex items-center justify-between p-3 bg-[var(--bg-page)] rounded border border-[var(--border)] hover:border-red-500 transition-colors"
                  >
                    <div>
                      <p className="font-mono text-xs text-[var(--accent)]">
                        #{item.rank}
                      </p>
                      <p className="font-mono text-xs text-[var(--text-muted)]">
                        {item.agent.slice(0, 6)}...{item.agent.slice(-4)}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-bold text-red-500">{item.score}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Improving */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Most Improving
              </h3>
              <div className="space-y-3">
                {rankings.improving.slice(0, 5).map(item => (
                  <div
                    key={item.agent}
                    className="flex items-center justify-between p-3 bg-[var(--bg-page)] rounded border border-[var(--border)] hover:border-emerald-500 transition-colors"
                  >
                    <p className="font-mono text-xs text-[var(--text-muted)]">
                      {item.agent.slice(0, 6)}...{item.agent.slice(-4)}
                    </p>
                    <p className="font-mono text-sm font-bold text-emerald-500">+{item.change}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Deteriorating */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Most Deteriorating
              </h3>
              <div className="space-y-3">
                {rankings.deteriorating.slice(0, 5).map(item => (
                  <div
                    key={item.agent}
                    className="flex items-center justify-between p-3 bg-[var(--bg-page)] rounded border border-[var(--border)] hover:border-red-500 transition-colors"
                  >
                    <p className="font-mono text-xs text-[var(--text-muted)]">
                      {item.agent.slice(0, 6)}...{item.agent.slice(-4)}
                    </p>
                    <p className="font-mono text-sm font-bold text-red-500">{item.change}%</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t border-[var(--border)] pt-6 mt-8">
          <p className="text-[var(--text-muted)] font-mono text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Last updated: {new Date().toLocaleTimeString()}
          </p>
          <p className="text-[var(--text-muted)] font-mono text-xs mt-2">
            <a href="/api/v1/docs" className="text-[var(--accent)] hover:underline">
              API Docs
            </a>
          </p>
        </footer>
      </div>
    </div>
  )
}

export default function WadjetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
        <p className="text-[var(--text-muted)] font-mono">Loading Wadjet...</p>
      </div>
    }>
      <WadjetDashboard />
    </Suspense>
  )
}

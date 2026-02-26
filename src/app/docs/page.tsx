'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Feather, Play, Shield, Coins, Flag, Radio,
  Bot, Plug, Cpu, Anchor, Gauge,
  Copy, CircleCheck, Zap
} from 'lucide-react'

const SIDEBAR_ITEMS = [
  { id: 'getting-started', icon: Play, label: 'Getting Started', active: true },
  { type: 'label', label: 'ENDPOINTS' },
  { id: 'endpoints', icon: Shield, label: 'GET /v1/score/{address}' },
  { id: 'endpoints', icon: Coins, label: 'GET /v1/token/{address}' },
  { id: 'endpoints', icon: Flag, label: 'POST /v1/report' },
  { id: 'endpoints', icon: Radio, label: 'POST /v1/signal' },
  { type: 'label', label: 'SDK & PLUGINS' },
  { id: 'code-examples', icon: Bot, label: 'AgentKit SDK' },
  { id: 'code-examples', icon: Plug, label: 'MCP Server' },
  { id: 'code-examples', icon: Cpu, label: 'ElizaOS Plugin' },
  { id: 'code-examples', icon: Anchor, label: 'Uniswap v4 Hook' },
  { type: 'label', label: 'RATE LIMITS' },
  { id: 'rate-limits', icon: Gauge, label: 'Rate Limits & Pricing' },
] as const

const CODE_TABS = ['JavaScript', 'Python', 'cURL', 'Solidity'] as const

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState<string>('JavaScript')

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="flex min-h-screen bg-page">
      {/* Sidebar */}
      <aside className="w-[280px] bg-surface border-r border-border-subtle pt-6 flex flex-col h-screen sticky top-0 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-6 pb-6 border-b border-border-subtle">
          <Feather className="w-6 h-6 text-gold" />
          <span className="font-mono text-base font-bold tracking-[3px] text-txt-primary">MAIAT</span>
          <span className="text-sm text-txt-muted">Docs</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-4">
          {SIDEBAR_ITEMS.map((item, i) => {
            if ('type' in item && item.type === 'label') {
              return (
                <span key={i} className="text-[10px] font-bold text-txt-muted tracking-[1.5px] mt-4 mb-1 px-3">
                  {item.label}
                </span>
              )
            }
            const navItem = item as { id: string; icon: React.ElementType; label: string; active?: boolean }
            const Icon = navItem.icon
            const isActive = navItem.active
            return (
              <button
                key={i}
                onClick={() => scrollTo(navItem.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left w-full transition-colors ${
                  isActive
                    ? 'bg-[#d4a01715] text-gold'
                    : 'text-txt-secondary hover:bg-elevated'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-gold' : 'text-txt-muted'}`} />
                <span className={`text-[13px] ${isActive ? 'font-semibold font-sans' : 'font-mono text-xs'}`}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col gap-10 px-16 py-12 overflow-y-auto">
        {/* Getting Started */}
        <section id="getting-started" className="flex flex-col gap-6">
          <h1 className="text-[32px] font-bold text-txt-primary">Getting Started</h1>
          <p className="text-base text-txt-secondary leading-[1.6]">
            The Maiat API provides trust scores for any blockchain address or token. Integrate trust intelligence into your dApp, agent, or protocol in minutes.
          </p>

          {/* Steps */}
          <div className="flex flex-col gap-4">
            {[
              'Get your free API key at dashboard.maiat.xyz',
              'Include your API key in the x-api-key header',
              'Query any address or token for its trust score',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-[14px] bg-gold">
                  <span className="text-sm font-bold text-page">{i + 1}</span>
                </div>
                <span className="text-[15px] text-txt-primary">{step}</span>
              </div>
            ))}
          </div>

          {/* Code Block */}
          <div className="flex flex-col bg-[#0d0e1a] rounded-xl border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="font-mono text-xs text-txt-muted">Quick Start &mdash; cURL</span>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded text-txt-muted hover:text-txt-primary transition-colors">
                <Copy className="w-3.5 h-3.5" />
                <span className="text-xs">Copy</span>
              </button>
            </div>
            <div className="flex flex-col gap-1 p-5">
              <code className="font-mono text-[13px] text-emerald">{'curl -X GET \\'}</code>
              <code className="font-mono text-[13px] text-gold-light">{"  'https://api.maiat.xyz/v1/score/0x742d...f2bD' \\"}</code>
              <code className="font-mono text-[13px] text-txt-secondary">{"  -H 'x-api-key: YOUR_API_KEY' \\"}</code>
              <code className="font-mono text-[13px] text-txt-secondary">{"  -H 'Content-Type: application/json'"}</code>
            </div>
          </div>

          {/* Response Block */}
          <div className="flex flex-col bg-[#0d0e1a] rounded-xl border border-border-subtle overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
              <div className="w-2 h-2 rounded-full bg-emerald" />
              <span className="font-mono text-xs text-emerald">Response &mdash; 200 OK</span>
            </div>
            <div className="flex flex-col gap-0.5 p-5">
              {[
                { text: '{', color: 'text-txt-secondary' },
                { text: '  "address": "0x742d...f2bD",', color: 'text-gold-light' },
                { text: '  "chain": "base",', color: 'text-txt-secondary' },
                { text: '  "score": 8.47,', color: 'text-emerald' },
                { text: '  "tier": "guardian",', color: 'text-emerald' },
                { text: '  "flags": [],', color: 'text-txt-secondary' },
                { text: '  "breakdown": {', color: 'text-txt-secondary' },
                { text: '    "transaction_history": 92,', color: 'text-txt-muted' },
                { text: '    "wallet_age": 88,', color: 'text-txt-muted' },
                { text: '    "defi_participation": 79,', color: 'text-txt-muted' },
                { text: '    "social_signals": 84', color: 'text-txt-muted' },
                { text: '  }', color: 'text-txt-secondary' },
                { text: '}', color: 'text-txt-secondary' },
              ].map((line, i) => (
                <code key={i} className={`font-mono text-[13px] ${line.color}`}>{line.text}</code>
              ))}
            </div>
          </div>
        </section>

        <div className="w-full h-px bg-border-subtle" />

        {/* Endpoints */}
        <section id="endpoints" className="flex flex-col gap-8">
          <h2 className="text-[28px] font-bold text-txt-primary">Endpoints</h2>

          {/* Endpoint Cards */}
          {[
            {
              method: 'GET', methodColor: 'text-emerald', methodBg: 'bg-[#00c9a720]',
              path: '/v1/score/{address}',
              desc: 'Returns the trust score, tier, flags, and full breakdown for any blockchain address. Supports Base, Ethereum, BSC, Polygon, and Arbitrum.',
              params: [
                { name: 'address', type: 'string', required: true, desc: 'The wallet or contract address to score' },
                { name: 'chain', type: 'query', required: false, desc: 'Chain ID or name (default: auto-detect)' },
              ],
            },
            {
              method: 'GET', methodColor: 'text-emerald', methodBg: 'bg-[#00c9a720]',
              path: '/v1/token/{address}',
              desc: 'Returns trust score, safety checks (honeypot, rug pull, audit status), holder distribution, and liquidity data for any ERC-20 token.',
              params: [
                { name: 'address', type: 'string', required: true, desc: 'The token contract address' },
                { name: 'include', type: 'query', required: false, desc: 'holders, liquidity, safety (comma-separated)' },
              ],
            },
            {
              method: 'POST', methodColor: 'text-gold', methodBg: 'bg-[#d4a01720]',
              path: '/v1/report', badge: 'v2',
              desc: 'Submit a trust report for an address. Allows users, agents, and protocols to flag suspicious behavior, scams, or verified trust signals.',
            },
            {
              method: 'POST', methodColor: 'text-gold', methodBg: 'bg-[#d4a01720]',
              path: '/v1/signal', badge: 'v2',
              desc: 'Emit a real-time trust signal from on-chain hooks or off-chain agents. Used by Uniswap v4 hooks and AI agents to contribute live scoring data.',
            },
          ].map((ep) => (
            <div key={ep.path} className="flex flex-col gap-5 bg-surface rounded-xl border border-border-subtle p-6">
              <div className="flex items-center gap-3">
                <span className={`font-mono text-xs font-bold ${ep.methodColor} ${ep.methodBg} px-2.5 py-1 rounded`}>
                  {ep.method}
                </span>
                <span className="font-mono text-base font-semibold text-txt-primary">{ep.path}</span>
                {ep.badge && (
                  <span className="text-[10px] font-bold text-turquoise bg-[#00b4d820] px-2 py-0.5 rounded">
                    {ep.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-txt-secondary leading-[1.5]">{ep.desc}</p>
              {ep.params && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-txt-primary">Parameters</span>
                  {ep.params.map((p) => (
                    <div key={p.name} className={`flex items-center gap-4 ${p.required ? 'bg-elevated' : ''} rounded-md px-3 py-2.5`}>
                      <span className="font-mono text-[13px] font-semibold text-gold">{p.name}</span>
                      <span className="font-mono text-xs text-txt-muted">{p.type}</span>
                      <span className={`text-[11px] font-semibold ${p.required ? 'text-crimson' : 'text-txt-muted'}`}>
                        {p.required ? 'required' : 'optional'}
                      </span>
                      <span className="text-[13px] text-txt-secondary">{p.desc}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="w-full h-px bg-border-subtle" />

        {/* Code Examples */}
        <section id="code-examples" className="flex flex-col gap-6">
          <h2 className="text-[28px] font-bold text-txt-primary">Code Examples</h2>
          <p className="text-[15px] text-txt-secondary">Integrate Maiat into your stack with just a few lines of code.</p>

          {/* Tabs */}
          <div className="flex border-b border-border-subtle">
            {CODE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-[13px] transition-colors ${
                  activeTab === tab
                    ? 'font-semibold text-gold border-b-2 border-gold'
                    : 'text-txt-muted hover:text-txt-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* JS Code Block */}
          <div className="flex flex-col bg-[#0d0e1a] rounded-xl border border-border-subtle overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <span className="font-mono text-xs text-txt-muted">maiat-sdk &mdash; JavaScript / TypeScript</span>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded text-txt-muted hover:text-txt-primary transition-colors">
                <Copy className="w-3.5 h-3.5" />
                <span className="text-xs">Copy</span>
              </button>
            </div>
            <div className="flex flex-col gap-0.5 p-5">
              {[
                { text: "import { Maiat } from '@maiat/sdk';", color: 'text-turquoise' },
                { text: '', color: '' },
                { text: 'const maiat = new Maiat({', color: 'text-txt-secondary' },
                { text: '  apiKey: process.env.MAIAT_API_KEY,', color: 'text-gold-light' },
                { text: "  chain: 'base'", color: 'text-gold-light' },
                { text: '});', color: 'text-txt-secondary' },
                { text: '', color: '' },
                { text: '// Get trust score for any address', color: 'text-txt-muted' },
                { text: 'const score = await maiat.score(', color: 'text-txt-secondary' },
                { text: "  '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28'", color: 'text-emerald' },
                { text: ');', color: 'text-txt-secondary' },
                { text: '', color: '' },
                { text: 'console.log(score.tier);', color: 'text-txt-secondary' },
                { text: "// => 'guardian' (score: 847)", color: 'text-txt-muted' },
              ].map((line, i) => (
                <code key={i} className={`font-mono text-[13px] ${line.color} ${line.text === '' ? 'h-4' : ''}`}>
                  {line.text}
                </code>
              ))}
            </div>
          </div>
        </section>

        <div className="w-full h-px bg-border-subtle" />

        {/* Rate Limits & Pricing */}
        <section id="rate-limits" className="flex flex-col gap-6">
          <h2 className="text-[28px] font-bold text-txt-primary">Rate Limits & Pricing</h2>
          <p className="text-[15px] text-txt-secondary leading-[1.5]">
            Choose the plan that fits your usage. All plans include access to every endpoint, real-time scoring, and multi-chain support.
          </p>

          <div className="flex gap-5 w-full">
            {/* Free */}
            <div className="flex-1 flex flex-col gap-4 bg-surface rounded-xl border border-border-subtle p-6">
              <span className="text-lg font-semibold text-txt-primary">Free</span>
              <div className="flex items-end gap-1">
                <span className="text-[36px] font-bold text-txt-primary">$0</span>
                <span className="text-sm text-txt-muted">/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-txt-muted" />
                <span className="text-sm text-txt-secondary">1,000 requests / day</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-txt-muted" />
                <span className="text-[13px] text-txt-secondary">All endpoints</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-txt-muted" />
                <span className="text-[13px] text-txt-secondary">Community support</span>
              </div>
              <button className="w-full py-3 rounded-lg border border-border-default text-sm font-semibold text-txt-primary hover:border-txt-muted transition-colors">
                Get Started
              </button>
            </div>

            {/* Pro */}
            <div className="flex-1 flex flex-col gap-4 bg-surface rounded-xl border-2 border-gold p-6">
              <span className="text-[11px] font-bold text-gold bg-[#d4a01720] px-3 py-1 rounded w-fit">Most Popular</span>
              <span className="text-lg font-semibold text-gold">Pro</span>
              <div className="flex items-end gap-1">
                <span className="text-[36px] font-bold text-txt-primary">$49</span>
                <span className="text-sm text-txt-muted">/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-gold" />
                <span className="text-sm text-txt-secondary">50,000 requests / day</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-gold" />
                <span className="text-[13px] text-txt-secondary">All endpoints + webhooks</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-gold" />
                <span className="text-[13px] text-txt-secondary">Priority support</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-gold" />
                <span className="text-[13px] text-txt-secondary">Batch scoring API</span>
              </div>
              <button className="w-full py-3 rounded-lg bg-gold text-sm font-bold text-page hover:brightness-110 transition-all">
                Subscribe
              </button>
            </div>

            {/* Scale */}
            <div className="flex-1 flex flex-col gap-4 bg-surface rounded-xl border border-border-subtle p-6">
              <span className="text-lg font-semibold text-txt-primary">Scale</span>
              <div className="flex items-end gap-1">
                <span className="text-[36px] font-bold text-txt-primary">$199</span>
                <span className="text-sm text-txt-muted">/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-turquoise" />
                <span className="text-sm text-txt-secondary">500,000 requests / day</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-turquoise" />
                <span className="text-[13px] text-txt-secondary">Everything in Pro</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-turquoise" />
                <span className="text-[13px] text-txt-secondary">Dedicated support</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-turquoise" />
                <span className="text-[13px] text-txt-secondary">Custom SLA & uptime</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleCheck className="w-3.5 h-3.5 text-turquoise" />
                <span className="text-[13px] text-txt-secondary">On-prem deployment</span>
              </div>
              <button className="w-full py-3 rounded-lg border border-border-default text-sm font-semibold text-txt-primary hover:border-txt-muted transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

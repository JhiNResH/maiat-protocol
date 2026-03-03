'use client'

import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ArrowRight, ArrowUpRight, Shield, Zap, GitBranch, Check, Copy } from 'lucide-react'
import { useState } from 'react'

const API_DEMO = `{
  "address": "0x742d35Cc...f2bD28",
  "chain": "base",
  "score": 8.47,
  "risk_level": "trusted",
  "verdict": "ALLOW",
  "signals": {
    "age_days": 812,
    "tx_count": 1247,
    "defi_activity": true,
    "blacklisted": false,
    "eas_attestations": 3
  },
  "latency_ms": 94
}`

const INTEGRATIONS = [
  {
    name: 'AgentKit',
    desc: 'Coinbase AgentKit plugin — block untrusted swaps automatically',
    color: '#0052FF',
    logo: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="13" stroke="#0052FF" strokeWidth="2"/>
        <path d="M9 14a5 5 0 0010 0H9z" fill="#0052FF"/>
      </svg>
    ),
  },
  {
    name: 'MCP Server',
    desc: 'Model Context Protocol — works with Claude, OpenClaw, any MCP host',
    color: '#d4a017',
    logo: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="4" width="8" height="8" rx="2" fill="#d4a017" opacity="0.8"/>
        <rect x="16" y="4" width="8" height="8" rx="2" fill="#d4a017" opacity="0.5"/>
        <rect x="4" y="16" width="8" height="8" rx="2" fill="#d4a017" opacity="0.5"/>
        <rect x="16" y="16" width="8" height="8" rx="2" fill="#d4a017" opacity="0.3"/>
      </svg>
    ),
  },
  {
    name: 'ElizaOS',
    desc: 'ai16z ElizaOS plugin — context injection for agent reasoning',
    color: '#7C3AED',
    logo: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 3L25 9V19L14 25L3 19V9L14 3Z" stroke="#7C3AED" strokeWidth="2" fill="none"/>
        <circle cx="14" cy="14" r="3" fill="#7C3AED"/>
      </svg>
    ),
  },
  {
    name: 'Uniswap v4',
    desc: 'TrustGateHook — on-chain trust enforcement before every swap',
    color: '#FF007A',
    logo: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M9 8c0 0 2-3 5-3s5 3 5 3" stroke="#FF007A" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="14" cy="16" r="6" stroke="#FF007A" strokeWidth="2"/>
        <circle cx="14" cy="16" r="2" fill="#FF007A"/>
      </svg>
    ),
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Query Any Address',
    desc: 'One GET request. Pass any EVM address — wallet, contract, or agent. Works across 6 chains.',
    color: 'var(--gold)',
    bgColor: 'rgba(212,160,23,0.08)',
  },
  {
    num: '02',
    title: 'Score Is Computed',
    desc: 'On-chain history, EAS attestations, blacklist checks, DeFi activity, and contract analysis — all in <120ms.',
    color: 'var(--blue)',
    bgColor: 'rgba(74,158,255,0.08)',
  },
  {
    num: '03',
    title: 'Protect & Gate',
    desc: 'Our Uniswap v4 Hook blocks untrusted swaps. Your MCP plugin gates tool calls. Agents trade with confidence.',
    color: 'var(--teal)',
    bgColor: 'rgba(0,201,167,0.08)',
  },
]

const STATS = [
  { value: '847K+', label: 'Addresses scored', color: 'var(--text-primary)' },
  { value: '<120ms', label: 'Avg latency', color: 'var(--teal)' },
  { value: '6', label: 'Chains supported', color: 'var(--blue)' },
  { value: '99.9%', label: 'API uptime', color: 'var(--gold)' },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 transition-all px-2 py-1 rounded"
      style={{
        color: copied ? 'var(--teal)' : 'var(--text-muted)',
        background: copied ? 'rgba(0,201,167,0.1)' : 'transparent',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg-base)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ========== HERO ========== */}
      <section
        className="relative flex flex-col items-center justify-center min-h-screen pt-16 px-6 overflow-hidden"
      >
        {/* Grid background */}
        <div
          className="absolute inset-0 grid-bg opacity-30"
          style={{ maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)' }}
        />

        {/* Glow orbs */}
        <div
          className="glow-orb"
          style={{
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, rgba(212,160,23,0.12) 0%, transparent 70%)',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />
        <div
          className="glow-orb"
          style={{
            width: 300,
            height: 300,
            background: 'radial-gradient(circle, rgba(74,158,255,0.08) 0%, transparent 70%)',
            bottom: '20%',
            right: '15%',
          }}
        />

        <div className="relative z-10 flex flex-col items-center gap-8 max-w-4xl text-center">
          {/* Badge */}
          <div
            className="pill animate-fade-up"
            style={{
              border: '1px solid rgba(212,160,23,0.3)',
              color: 'var(--gold)',
              background: 'rgba(212,160,23,0.06)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)', display: 'inline-block' }} />
            Now live on Base Sepolia
          </div>

          {/* Headline */}
          <h1
            className="text-[52px] md:text-[76px] font-extrabold tracking-[-3px] leading-[0.95] animate-fade-up delay-1"
            style={{ color: 'var(--text-primary)' }}
          >
            Trust infrastructure<br />
            <span className="text-gold-gradient">for AI agents.</span>
          </h1>

          {/* Subline */}
          <p
            className="text-lg md:text-xl max-w-[560px] leading-[1.65] animate-fade-up delay-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Query any address. Get a trust score. Gate swaps, tool calls, and agent interactions — on-chain.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 animate-fade-up delay-3">
            <Link href="https://maiat-protocol.vercel.app/explore" className="btn-primary">
              Launch App
              <ArrowRight size={16} />
            </Link>
            <Link href="https://maiat-protocol.vercel.app/docs" className="btn-secondary">
              Read the Docs
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {/* Inline API preview */}
          <div
            className="animate-fade-up delay-4 w-full max-w-xl rounded-xl overflow-hidden mt-2"
            style={{
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
            }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f87171' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#fbbf24' }} />
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--teal)' }} />
                <span className="font-mono text-[10px] ml-1 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>terminal</span>
              </div>
              <CopyButton text="curl https://maiat-protocol.vercel.app/api/v1/score/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28" />
            </div>
            <div className="px-5 py-4 text-left">
              <p className="font-mono text-[12px] leading-5" style={{ color: 'var(--teal)' }}>
                $ curl https://maiat-protocol.vercel.app/api/v1/score/0x742d35Cc...
              </p>
              <div className="mt-3">
                {API_DEMO.split('\n').map((line, i) => {
                  const isScore = line.includes('"score"')
                  const isVerdict = line.includes('"verdict"')
                  const isKey = line.trim().startsWith('"') && line.includes(':')
                  return (
                    <p
                      key={i}
                      className="font-mono text-[12px] leading-[1.7]"
                      style={{
                        color: isScore
                          ? 'var(--gold)'
                          : isVerdict
                          ? 'var(--teal)'
                          : isKey
                          ? 'var(--blue)'
                          : 'var(--text-muted)',
                      }}
                    >
                      {line}
                    </p>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-up delay-6"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-current opacity-40" />
        </div>
      </section>

      {/* ========== STATS BAR ========== */}
      <div
        className="relative"
        style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-0">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 py-4 md:py-0"
              style={{
                borderRight: i < 3 ? '1px solid var(--border-subtle)' : undefined,
              }}
            >
              <span className="font-mono text-[28px] font-semibold tracking-tight" style={{ color: s.color }}>
                {s.value}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ========== HOW IT WORKS ========== */}
      <section className="relative py-28 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4 mb-16">
            <span className="section-label" style={{ color: 'var(--gold)' }}>How It Works</span>
            <h2 className="text-4xl md:text-[48px] font-bold tracking-[-1.5px] text-center" style={{ color: 'var(--text-primary)' }}>
              From query to protection<br />in milliseconds.
            </h2>
            <p className="text-base max-w-[480px] text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Maiat sits between your agent and the blockchain, intercepting every interaction before it costs anything real.
            </p>
          </div>

          {/* Steps */}
          <div className="flex flex-col md:flex-row gap-4">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="flex-1 relative rounded-2xl p-8 card-hover"
                style={{ background: 'var(--bg-card)' }}
              >
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-12 -right-2.5 w-5 h-px z-10"
                    style={{ background: `linear-gradient(to right, ${step.color}, transparent)` }}
                  />
                )}

                <div
                  className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-6 font-mono font-bold text-sm"
                  style={{ background: step.bgColor, color: step.color }}
                >
                  {step.num}
                </div>

                <h3 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                  {step.title}
                </h3>
                <p className="text-[14px] leading-[1.7]" style={{ color: 'var(--text-secondary)' }}>
                  {step.desc}
                </p>

                <div
                  className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
                  style={{ background: `linear-gradient(to right, transparent, ${step.color}40, transparent)` }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== INTEGRATIONS ========== */}
      <section
        className="py-28 px-6"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4 mb-16">
            <span className="section-label" style={{ color: 'var(--blue)' }}>Integrations</span>
            <h2 className="text-4xl md:text-[48px] font-bold tracking-[-1.5px] text-center" style={{ color: 'var(--text-primary)' }}>
              Plug into every agent<br />framework.
            </h2>
            <p className="text-base max-w-[460px] text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              One npm install. Consistent behavior across every major agentic runtime.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INTEGRATIONS.map((item) => (
              <div
                key={item.name}
                className="flex flex-col gap-4 rounded-2xl p-6 card-hover cursor-default"
                style={{ background: 'var(--bg-card)' }}
              >
                <div className="w-12 h-12 flex items-center justify-center">
                  {item.logo}
                </div>
                <div>
                  <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                    {item.name}
                  </h3>
                  <p className="text-[13px] leading-[1.6]" style={{ color: 'var(--text-muted)' }}>
                    {item.desc}
                  </p>
                </div>
                <div
                  className="font-mono text-[11px] font-semibold mt-auto inline-flex items-center gap-1.5"
                  style={{ color: item.color }}
                >
                  <span className="w-1 h-1 rounded-full inline-block" style={{ background: item.color }} />
                  npm install @maiat/{item.name.toLowerCase().replace(' ', '-')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FOR DEVELOPERS ========== */}
      <section className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start gap-16">
            {/* Left: copy */}
            <div className="flex-1 flex flex-col gap-8">
              <div className="flex flex-col gap-5">
                <span className="section-label" style={{ color: 'var(--teal)' }}>For Developers</span>
                <h2 className="text-4xl md:text-[48px] font-bold tracking-[-1.5px]" style={{ color: 'var(--text-primary)' }}>
                  One request.<br />Complete trust signal.
                </h2>
                <p className="text-base leading-[1.75]" style={{ color: 'var(--text-secondary)' }}>
                  Free tier, no API key required. Sub-100ms responses. Integrate trust scoring into your agent in under five minutes.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { label: 'REST API', desc: 'GET /v1/score/{address} — clean JSON, immediate integration' },
                  { label: 'Multi-chain', desc: 'Base, Ethereum, Polygon, Arbitrum, Optimism, BNB Chain' },
                  { label: 'Cached locally', desc: '5-minute cache in all SDK packages, reduces latency to <5ms on repeat queries' },
                  { label: 'EAS-powered', desc: 'Ethereum Attestation Service receipts get 5× trust weight boost' },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                      style={{ background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.3)' }}
                    >
                      <Check size={11} style={{ color: 'var(--teal)' }} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label} — </span>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Link href="https://maiat-protocol.vercel.app/docs" className="btn-primary">
                  Read the Docs
                  <ArrowUpRight size={15} />
                </Link>
                <a
                  href="https://github.com/JhiNResH/maiat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  View on GitHub
                </a>
              </div>
            </div>

            {/* Right: code block */}
            <div
              className="flex-1 w-full rounded-2xl overflow-hidden"
              style={{
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
              }}
            >
              {/* Tab bar */}
              <div
                className="flex items-center gap-0"
                style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
              >
                {['TypeScript', 'Python', 'cURL'].map((tab, i) => (
                  <div
                    key={tab}
                    className="px-5 py-3 text-[12px] font-mono font-medium"
                    style={{
                      color: i === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      borderBottom: i === 0 ? '2px solid var(--gold)' : '2px solid transparent',
                    }}
                  >
                    {tab}
                  </div>
                ))}
                <div className="ml-auto pr-4">
                  <CopyButton text={`import { MaiatClient } from '@maiat/agentkit-plugin'

const maiat = new MaiatClient({ chain: 'base' })

// Before any agent interaction
const trust = await maiat.checkTrust(targetAddress)

if (trust.score < 7.0) {
  throw new MaiatTrustError(trust)
}

// Safe to proceed
await agent.execute(action)`} />
                </div>
              </div>

              {/* Code */}
              <div className="p-6 overflow-x-auto">
                <pre className="font-mono text-[13px] leading-[1.8]">
{[
  { text: "import", c: 'var(--blue)' },
  { text: " { MaiatClient } ", c: 'var(--text-primary)' },
  { text: "from", c: 'var(--blue)' },
  { text: " '@maiat/agentkit-plugin'", c: 'var(--teal)' },
].map((t, i) => <span key={i} style={{ color: t.c }}>{t.text}</span>)}
{'\n\n'}
<span style={{ color: 'var(--text-muted)' }}>{'// Initialize the client'}</span>{'\n'}
<span style={{ color: 'var(--blue)' }}>const</span>
<span style={{ color: 'var(--text-primary)' }}> maiat </span>
<span style={{ color: 'var(--text-secondary)' }}>=</span>
<span style={{ color: 'var(--blue)' }}> new</span>
<span style={{ color: 'var(--gold)' }}> MaiatClient</span>
<span style={{ color: 'var(--text-primary)' }}>{'({ chain: '}</span>
<span style={{ color: 'var(--teal)' }}>'base'</span>
<span style={{ color: 'var(--text-primary)' }}>{' })'}</span>{'\n\n'}
<span style={{ color: 'var(--text-muted)' }}>{'// Check trust before any agent interaction'}</span>{'\n'}
<span style={{ color: 'var(--blue)' }}>const</span>
<span style={{ color: 'var(--text-primary)' }}> trust </span>
<span style={{ color: 'var(--text-secondary)' }}>= await</span>
<span style={{ color: 'var(--text-primary)' }}> maiat</span>
<span style={{ color: 'var(--text-secondary)' }}>.</span>
<span style={{ color: 'var(--gold)' }}>checkTrust</span>
<span style={{ color: 'var(--text-primary)' }}>(targetAddress){'\n\n'}</span>
<span style={{ color: 'var(--blue)' }}>if</span>
<span style={{ color: 'var(--text-primary)' }}> (trust.score </span>
<span style={{ color: 'var(--text-secondary)' }}>{'< '}</span>
<span style={{ color: 'var(--blue)' }}>7.0</span>
<span style={{ color: 'var(--text-primary)' }}>) {'{'}{'\n'}{'  '}</span>
<span style={{ color: 'var(--blue)' }}>throw</span>
<span style={{ color: 'var(--blue)' }}> new</span>
<span style={{ color: 'var(--gold)' }}> MaiatTrustError</span>
<span style={{ color: 'var(--text-primary)' }}>(trust){'\n'}{'}'}{'\n\n'}</span>
<span style={{ color: 'var(--text-muted)' }}>{'// Safe to proceed'}</span>{'\n'}
<span style={{ color: 'var(--blue)' }}>await</span>
<span style={{ color: 'var(--text-primary)' }}> agent</span>
<span style={{ color: 'var(--text-secondary)' }}>.</span>
<span style={{ color: 'var(--gold)' }}>execute</span>
<span style={{ color: 'var(--text-primary)' }}>(action)</span>
                </pre>
              </div>

              {/* Result bar */}
              <div
                className="px-6 py-3 flex items-center gap-2"
                style={{ borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,201,167,0.04)' }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: 'var(--teal)', boxShadow: '0 0 6px var(--teal)' }}
                />
                <span className="font-mono text-[11px]" style={{ color: 'var(--teal)' }}>
                  trust.score = 8.47 · verdict: ALLOW · latency: 94ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TRUST SCORE EXPLAINER ========== */}
      <section
        className="py-28 px-6"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center gap-4 mb-16">
            <span className="section-label" style={{ color: 'var(--gold)' }}>Trust Score</span>
            <h2 className="text-4xl md:text-[48px] font-bold tracking-[-1.5px] text-center" style={{ color: 'var(--text-primary)' }}>
              Not just a number.
            </h2>
            <p className="text-base max-w-[480px] text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Every score is an aggregation of on-chain signals. Transparent, explainable, and hard to game.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                label: 'Wallet Age & Activity',
                desc: 'Older wallets with consistent activity patterns score higher. Sybil farms fail instantly.',
                icon: '⏱',
                weight: '20%',
              },
              {
                label: 'EAS Attestations',
                desc: 'Ethereum Attestation Service receipts carry 5× weight. Verified identities matter.',
                icon: '🔏',
                weight: '25%',
              },
              {
                label: 'DeFi Participation',
                desc: 'Lending, LP positions, governance votes — legitimate protocol usage signals trust.',
                icon: '📊',
                weight: '20%',
              },
              {
                label: 'Blacklist Screening',
                desc: 'OFAC, Chainalysis, TRM Labs — multi-source screening, zero tolerance.',
                icon: '🚫',
                weight: '20%',
              },
              {
                label: 'Contract Analysis',
                desc: 'Is the counterparty a contract? Verified source, audit history, and bytecode analysis.',
                icon: '📋',
                weight: '10%',
              },
              {
                label: 'Social Verification',
                desc: 'ENS, Farcaster, World ID, Lens — optional but weighted for human presence.',
                icon: '🌐',
                weight: '5%',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-6 card-hover"
                style={{ background: 'var(--bg-card)' }}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-2xl">{item.icon}</span>
                  <span
                    className="font-mono text-[11px] font-bold px-2 py-0.5 rounded"
                    style={{ color: 'var(--gold)', background: 'rgba(212,160,23,0.1)', border: '1px solid rgba(212,160,23,0.2)' }}
                  >
                    {item.weight}
                  </span>
                </div>
                <h3 className="font-semibold text-[15px] mb-2" style={{ color: 'var(--text-primary)' }}>
                  {item.label}
                </h3>
                <p className="text-[13px] leading-[1.6]" style={{ color: 'var(--text-muted)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="relative py-28 px-6 overflow-hidden">
        <div
          className="glow-orb"
          style={{
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(212,160,23,0.1) 0%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-8 text-center">
          <div
            className="flex items-center gap-2.5 px-5 py-2 rounded-full"
            style={{ border: '1px solid rgba(212,160,23,0.25)', background: 'rgba(212,160,23,0.04)' }}
          >
            <Shield size={14} style={{ color: 'var(--gold)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--gold)' }}>
              Free tier available · No API key required
            </span>
          </div>

          <h2
            className="text-[44px] md:text-[60px] font-extrabold tracking-[-2px] leading-[1.05]"
            style={{ color: 'var(--text-primary)' }}
          >
            Start trusting on-chain.<br />
            <span className="text-gold-gradient">Today.</span>
          </h2>

          <p className="text-lg max-w-[440px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            The agent economy needs a trust layer. Be the first to deploy one that actually works.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="https://maiat-protocol.vercel.app/explore" className="btn-primary text-base px-10 py-4">
              Launch App
              <ArrowRight size={18} />
            </Link>
            <Link href="https://maiat-protocol.vercel.app/docs" className="btn-secondary text-base px-10 py-4">
              API Reference
            </Link>
          </div>

          {/* Powered by */}
          <div className="flex items-center gap-6 mt-4">
            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Powered by</span>
            <div className="flex items-center gap-4">
              {[
                { label: 'Base', color: '#0052FF' },
                { label: 'Uniswap v4', color: '#FF007A' },
                { label: 'Chainlink', color: '#375BD2' },
                { label: 'EAS', color: 'var(--teal)' },
              ].map((b) => (
                <span key={b.label} className="text-xs font-semibold font-mono" style={{ color: b.color }}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

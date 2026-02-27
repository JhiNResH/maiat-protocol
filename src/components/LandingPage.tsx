'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Shield, Zap, Globe, Bot, Code2, ArrowRight,
  CheckCircle2, Link2, Coins, Lock, Activity,
  ChevronRight, ExternalLink, Play, Copy, CircleCheck
} from 'lucide-react'

// ============================================================================
// LIVE DEMO — Try the API
// ============================================================================

const EXAMPLE_ADDRESSES = [
  { label: 'Uniswap V3 Router', address: '0x2626664c2603336E57B271c5C0b26F421741e481' },
  { label: 'Aave V3 Pool', address: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5' },
  { label: 'Random Wallet', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
]

function LiveDemo() {
  const [address, setAddress] = useState(EXAMPLE_ADDRESSES[0].address)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function checkTrust() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/v1/trust-check?agent=${address}`)
      const data = await res.json()
      setResult(data)
    } catch (e) {
      setResult({ error: 'Failed to fetch. Try again.' })
    }
    setLoading(false)
  }

  const curlCmd = `curl "https://maiat-protocol.vercel.app/api/v1/trust-check?agent=${address}"`

  function copyCurl() {
    navigator.clipboard.writeText(curlCmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-elevated/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs font-mono text-txt-muted ml-2">Live API Playground</span>
      </div>

      <div className="p-6 space-y-4">
        {/* Quick select */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_ADDRESSES.map((ex) => (
            <button
              key={ex.address}
              onClick={() => setAddress(ex.address)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                address === ex.address
                  ? 'border-gold bg-gold/10 text-gold'
                  : 'border-border-subtle text-txt-muted hover:border-txt-muted'
              }`}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Input + button */}
        <div className="flex gap-2">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className="flex-1 bg-page border border-border-subtle rounded-lg px-4 py-3 font-mono text-sm text-txt-primary focus:outline-none focus:border-gold/50 transition-colors"
          />
          <button
            onClick={checkTrust}
            disabled={loading}
            className="px-6 py-3 bg-gold text-black font-semibold rounded-lg hover:bg-gold-light transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            Check
          </button>
        </div>

        {/* cURL */}
        <div className="flex items-center gap-2 bg-page rounded-lg px-4 py-2.5 border border-border-subtle">
          <code className="text-xs text-txt-muted font-mono flex-1 overflow-x-auto whitespace-nowrap">
            $ {curlCmd}
          </code>
          <button onClick={copyCurl} className="text-txt-muted hover:text-gold transition-colors shrink-0">
            {copied ? <CircleCheck className="w-4 h-4 text-emerald" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-page rounded-lg border border-border-subtle p-4 animate-in fade-in slide-in-from-bottom-2">
            {result.error ? (
              <p className="text-crimson text-sm">{result.error}</p>
            ) : (
              <div className="space-y-3">
                {/* Verdict badge */}
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold font-mono ${
                    result.verdict === 'proceed' ? 'text-emerald' :
                    result.verdict === 'caution' ? 'text-amber' : 'text-crimson'
                  }`}>
                    {result.score?.toFixed(1) ?? '—'}/10
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                    result.verdict === 'proceed'
                      ? 'bg-emerald/10 text-emerald border border-emerald/20'
                      : result.verdict === 'caution'
                      ? 'bg-amber/10 text-amber border border-amber/20'
                      : 'bg-crimson/10 text-crimson border border-crimson/20'
                  }`}>
                    {result.verdict ?? result.risk ?? 'unknown'}
                  </span>
                </div>
                {/* Raw JSON toggle */}
                <details className="group">
                  <summary className="text-xs text-txt-muted cursor-pointer hover:text-txt-secondary transition-colors">
                    View raw JSON response →
                  </summary>
                  <pre className="mt-2 text-xs font-mono text-txt-secondary overflow-x-auto max-h-[300px] overflow-y-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// STATS
// ============================================================================

function Stats() {
  const stats = [
    { value: '2,200+', label: 'Addresses Scored', icon: Shield },
    { value: '<200ms', label: 'API Latency', icon: Zap },
    { value: '3', label: 'Chains Supported', icon: Globe },
    { value: '5', label: 'SDK Plugins', icon: Bot },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface border border-border-subtle rounded-xl p-5 text-center group hover:border-gold/30 transition-all">
          <s.icon className="w-5 h-5 text-gold mx-auto mb-3 opacity-60 group-hover:opacity-100 transition-opacity" />
          <div className="text-2xl font-bold font-mono text-txt-primary">{s.value}</div>
          <div className="text-xs text-txt-muted mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// FEATURES
// ============================================================================

const FEATURES = [
  {
    icon: Shield,
    title: 'Trust Scoring API',
    description: 'One GET request returns a 0-10 trust score with full breakdown: on-chain history, contract analysis, blacklist check, community reviews.',
    link: '/docs',
    linkLabel: 'View API Docs',
  },
  {
    icon: Link2,
    title: 'Chainlink CRE Oracle',
    description: 'Trust scores verified and attested on-chain via Chainlink Compute Runtime Environment. Decentralized, tamper-proof, always up-to-date.',
    link: '/demo',
    linkLabel: 'See Demo',
  },
  {
    icon: Lock,
    title: 'Uniswap v4 Hook',
    description: 'TrustGateHook blocks swaps with untrusted counterparties automatically. Score below threshold → transaction reverted. No human intervention needed.',
    link: '/swap',
    linkLabel: 'Try Swap',
  },
  {
    icon: Coins,
    title: 'x402 Paid Trust Gate',
    description: 'Agents pay $0.02 per query via Coinbase x402 protocol. Standard HTTP — any agent with a wallet can query trust scores programmatically.',
    link: '/docs',
    linkLabel: 'Integration Guide',
  },
  {
    icon: Activity,
    title: 'Community Reviews',
    description: 'Stake Scarab tokens to submit reviews. Staked reviews carry more weight. Gaming the system costs real money. Truth rises.',
    link: '/review',
    linkLabel: 'Write Review',
  },
  {
    icon: Bot,
    title: '5 Agent SDKs',
    description: 'Drop-in plugins for AgentKit, MCP Server, ElizaOS, GAME, and Virtuals. One line of code adds trust scoring to any AI agent framework.',
    link: '/docs#code-examples',
    linkLabel: 'SDK Docs',
  },
]

function Features() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="bg-surface border border-border-subtle rounded-xl p-6 group hover:border-gold/30 transition-all"
        >
          <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center mb-4">
            <f.icon className="w-5 h-5 text-gold" />
          </div>
          <h3 className="text-lg font-semibold text-txt-primary mb-2">{f.title}</h3>
          <p className="text-sm text-txt-secondary leading-relaxed mb-4">{f.description}</p>
          <Link
            href={f.link}
            className="text-sm text-gold hover:text-gold-light inline-flex items-center gap-1 transition-colors"
          >
            {f.linkLabel} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// INTEGRATION CODE SNIPPET
// ============================================================================

function IntegrationSnippet() {
  const [tab, setTab] = useState<'agentkit' | 'mcp' | 'curl'>('agentkit')

  const snippets = {
    agentkit: `import { maiatTrustPlugin } from "@maiat/agentkit-plugin";

const agent = new AgentKit({ ... });
agent.use(maiatTrustPlugin({ minScore: 3.0 }));
// Every transaction now gets a trust check ✓`,
    mcp: `// claude_desktop_config.json
{
  "mcpServers": {
    "maiat": {
      "command": "npx",
      "args": ["@maiat/mcp-server"]
    }
  }
}
// "Check if 0x1234 is safe" → Maiat returns score`,
    curl: `# Check any address in <200ms
curl "https://maiat-protocol.vercel.app/api/v1/trust-check\\
  ?agent=0x2626664c2603336E57B271c5C0b26F421741e481"

# Response:
# { "score": 8.2, "verdict": "proceed", ... }`,
  }

  return (
    <div className="bg-surface border border-border-subtle rounded-2xl overflow-hidden">
      <div className="flex border-b border-border-subtle">
        {(['agentkit', 'mcp', 'curl'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium transition-all ${
              tab === t
                ? 'text-gold border-b-2 border-gold bg-elevated/30'
                : 'text-txt-muted hover:text-txt-secondary'
            }`}
          >
            {t === 'agentkit' ? 'AgentKit' : t === 'mcp' ? 'MCP Server' : 'cURL'}
          </button>
        ))}
      </div>
      <pre className="p-6 text-sm font-mono text-txt-secondary overflow-x-auto leading-relaxed">
        {snippets[tab]}
      </pre>
    </div>
  )
}

// ============================================================================
// ARCHITECTURE DIAGRAM
// ============================================================================

function Architecture() {
  const layers = [
    {
      label: 'DATA SOURCES',
      color: 'text-turquoise',
      borderColor: 'border-turquoise/20',
      items: ['On-chain History', 'Blacklists', 'Contract Analysis', 'Community Reviews', 'Agent Reports'],
    },
    {
      label: 'TRUST ENGINE',
      color: 'text-gold',
      borderColor: 'border-gold/20',
      items: ['Weighted Scoring', 'Chainlink CRE', 'Oracle Attestation'],
    },
    {
      label: 'OUTPUTS',
      color: 'text-emerald',
      borderColor: 'border-emerald/20',
      items: ['REST API', 'v4 Hook', 'AgentKit SDK', 'MCP Server', 'x402 Gate'],
    },
  ]

  return (
    <div className="flex flex-col md:flex-row gap-4 items-stretch">
      {layers.map((layer, i) => (
        <div key={layer.label} className="flex-1 flex flex-col items-center gap-3">
          <span className={`text-xs font-mono font-bold tracking-widest ${layer.color}`}>
            {layer.label}
          </span>
          <div className={`w-full bg-surface border ${layer.borderColor} rounded-xl p-4 flex-1`}>
            <div className="flex flex-col gap-2">
              {layer.items.map((item) => (
                <div
                  key={item}
                  className="text-sm text-txt-secondary bg-page rounded-lg px-3 py-2 text-center"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          {i < layers.length - 1 && (
            <ArrowRight className="w-5 h-5 text-txt-muted hidden md:block absolute" style={{ display: 'none' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// PARTNERS / TECH
// ============================================================================

function TechStack() {
  const tech = [
    { name: 'Base', desc: 'Primary chain' },
    { name: 'Chainlink CRE', desc: 'Oracle attestation' },
    { name: 'Uniswap v4', desc: 'Hook enforcement' },
    { name: 'Coinbase x402', desc: 'Agent payments' },
    { name: 'AgentKit', desc: 'SDK plugin' },
    { name: 'MCP', desc: 'Claude/GPT' },
  ]

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {tech.map((t) => (
        <div
          key={t.name}
          className="bg-surface border border-border-subtle rounded-lg px-5 py-3 text-center hover:border-gold/20 transition-all"
        >
          <div className="text-sm font-semibold text-txt-primary">{t.name}</div>
          <div className="text-xs text-txt-muted">{t.desc}</div>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// MAIN LANDING PAGE
// ============================================================================

export function LandingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-20">
      {/* ── HERO ── */}
      <section className="text-center space-y-6 pt-8">
        <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 text-xs text-gold font-medium">
          <Zap className="w-3.5 h-3.5" />
          Live on Base Sepolia — Chainlink Convergence 2026
        </div>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight">
          The Trust Layer for the{' '}
          <span className="text-gold">Agent Economy</span>
        </h1>
        <p className="text-lg md:text-xl text-txt-secondary max-w-2xl mx-auto leading-relaxed">
          One API call. Instant trust scores for any on-chain address.
          Built for AI agents. Verified by Chainlink. Enforced via Uniswap v4 Hooks.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 bg-gold text-black px-6 py-3 rounded-lg font-semibold hover:bg-gold-light transition-all"
          >
            Explore Scores <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 bg-surface border border-border-subtle text-txt-primary px-6 py-3 rounded-lg font-semibold hover:border-gold/30 transition-all"
          >
            <Code2 className="w-4 h-4" /> API Docs
          </Link>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 bg-surface border border-border-subtle text-txt-primary px-6 py-3 rounded-lg font-semibold hover:border-gold/30 transition-all"
          >
            <Play className="w-4 h-4" /> Watch Demo
          </Link>
        </div>
      </section>

      {/* ── STATS ── */}
      <Stats />

      {/* ── LIVE API PLAYGROUND ── */}
      <section className="space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">Try It Live</h2>
          <p className="text-txt-secondary">Paste any address. Get a trust score in milliseconds.</p>
        </div>
        <LiveDemo />
      </section>

      {/* ── FEATURES ── */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">How It Works</h2>
          <p className="text-txt-secondary">Six layers of trust infrastructure, one seamless API.</p>
        </div>
        <Features />
      </section>

      {/* ── ARCHITECTURE ── */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">Architecture</h2>
          <p className="text-txt-secondary">Data in → Trust engine → Actionable output.</p>
        </div>
        <Architecture />
      </section>

      {/* ── INTEGRATION ── */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">Integrate in 3 Lines</h2>
          <p className="text-txt-secondary">Drop-in plugins for every major agent framework.</p>
        </div>
        <IntegrationSnippet />
      </section>

      {/* ── TECH STACK ── */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">Built With</h2>
        </div>
        <TechStack />
      </section>

      {/* ── CONTRACTS ── */}
      <section className="bg-surface border border-border-subtle rounded-2xl p-8 space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Globe className="w-5 h-5 text-gold" /> Deployed Contracts
          <span className="text-xs bg-emerald/10 text-emerald px-2 py-0.5 rounded-full ml-2">Base Sepolia</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-page rounded-lg p-4 border border-border-subtle">
            <div className="text-xs text-txt-muted mb-1">TrustScoreOracle</div>
            <code className="text-sm font-mono text-turquoise break-all">
              0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139
            </code>
          </div>
          <div className="bg-page rounded-lg p-4 border border-border-subtle">
            <div className="text-xs text-txt-muted mb-1">TrustGateHook (Uniswap v4)</div>
            <code className="text-sm font-mono text-turquoise break-all">
              0xF6065FB076090af33eE0402f7e902B2583e7721E
            </code>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="text-center space-y-6 pb-12">
        <h2 className="text-2xl md:text-3xl font-bold">
          Stop trusting. Start <span className="text-gold">verifying</span>.
        </h2>
        <p className="text-txt-secondary max-w-lg mx-auto">
          Maiat is the SSL certificate for the agent economy. Every transaction gets a trust check — automatic, instant, embedded in infrastructure.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 bg-gold text-black px-8 py-3.5 rounded-lg font-semibold hover:bg-gold-light transition-all text-lg"
          >
            Get Started <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href="https://github.com/JhiNResH/maiat-protocol"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-surface border border-border-subtle text-txt-primary px-8 py-3.5 rounded-lg font-semibold hover:border-gold/30 transition-all text-lg"
          >
            GitHub <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  )
}

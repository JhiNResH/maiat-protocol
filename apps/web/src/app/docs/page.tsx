'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Zap, Shield, Search,
  MessageSquare, Globe,
  Terminal, Code, Layers, Cpu,
  Copy, CheckCircle
} from 'lucide-react'

// ── Components ────────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative liquid-glass rounded-2xl overflow-hidden border border-[var(--border-color)]">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border-color)]">
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{lang}</span>
        <button onClick={copy} className="text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors">
          {copied ? <CheckCircle size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      </div>
      <pre className="p-5 text-xs font-mono text-[var(--text-secondary)] overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function ApiEndpoint({ method, path, title }: { method: string; path: string; title: string }) {
  return (
    <div className="flex flex-col gap-2 p-5 rounded-2xl liquid-glass border border-[var(--border-color)]">
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
          method === 'GET'
            ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
            : method === 'POST'
            ? 'border-blue-500/30 text-blue-500 bg-blue-500/10'
            : 'border-[var(--border-color)] text-[var(--text-muted)] bg-[var(--bg-color)]'
        }`}>{method}</span>
        <span className="text-xs font-mono font-bold text-[var(--text-color)]">{path}</span>
      </div>
      <h4 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-tight">{title}</h4>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-[var(--border-color)] mb-8">
      <div className="w-10 h-10 rounded-2xl liquid-glass border border-[var(--border-color)] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[var(--text-secondary)]" />
      </div>
      <h2 className="text-2xl font-black text-[var(--text-color)] uppercase tracking-tight">{title}</h2>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <div className="pb-20">
      <main className="max-w-4xl mx-auto px-6">

        {/* Hero */}
        <section className="pt-12 mb-16 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="atmosphere-text font-black text-[var(--text-color)]"
          >
            Docs
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[var(--text-secondary)] text-xl max-w-2xl font-medium mx-auto mt-8"
          >
            API Reference &amp; SDK docs for the Maiat Trust Protocol — the trust layer for agentic commerce.
          </motion.p>
        </section>

        {/* Quick nav anchors */}
        <motion.nav
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap gap-3 mb-16 justify-center"
        >
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'trust-score', label: 'Trust Score' },
            { id: 'wadjet', label: 'Wadjet' },
            { id: 'sentinel', label: 'Sentinel' },
            { id: 'agents-api', label: 'Agents API' },
            { id: 'reviews-api', label: 'Reviews API' },
            { id: 'offerings', label: 'ACP' },
            { id: 'installation', label: 'Install' },
            { id: 'usage', label: 'Quick Start' },
          ].map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="px-4 py-2 rounded-xl liquid-glass border border-[var(--border-color)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-all"
            >
              {item.label}
            </a>
          ))}
        </motion.nav>

        <div className="flex flex-col gap-20">

          {/* ── Overview ── */}
          <section id="overview">
            <SectionHeader icon={Code} title="Overview" />

            <p className="text-[var(--text-secondary)] text-base leading-relaxed mb-8 border-l-4 border-[var(--border-color)] pl-6">
              Maiat is the trust layer for agentic commerce — answering one question: &ldquo;Is this agent trustworthy?&rdquo;
              Powered by Wadjet, an ML risk engine combining on-chain behavior, token health, and community reviews.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Zap, label: 'Zero Auth', desc: 'All public endpoints require no API keys' },
                { icon: Shield, label: 'Verified Data', desc: 'Trust scores backed by on-chain proofs' },
                { icon: Globe, label: 'Base Mainnet', desc: 'Unified monitoring across Base Mainnet' },
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="p-6 liquid-glass rounded-[2rem] border border-[var(--border-color)] space-y-3 hover-lift"
                >
                  <feature.icon className="w-5 h-5 text-[var(--text-secondary)]" />
                  <div className="font-bold text-[var(--text-color)] text-xs uppercase tracking-widest">{feature.label}</div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Trust Score ── */}
          <section id="trust-score">
            <SectionHeader icon={Shield} title="Trust Score Mechanism" />

            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-8">
              Maiat synthesizes three data layers to compute a real-time trust score (0–100).
            </p>

            <div className="space-y-4">
              {[
                { label: 'On-Chain Behavioral', val: '50%', desc: 'ACP job history — completion rate, payment rate, total jobs.' },
                { label: 'Off-Chain Signals', val: '30%', desc: 'Token health via Wadjet — liquidity, rug probability, price trends.' },
                { label: 'Human Reviews', val: '20%', desc: 'Community ratings, sentiment, weighted by reviewer reputation.' },
              ].map((layer, i) => (
                <div key={i} className="flex items-center justify-between p-5 liquid-glass rounded-2xl border border-[var(--border-color)]">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[var(--text-color)] uppercase tracking-widest">{layer.label}</div>
                    <p className="text-[10px] text-[var(--text-muted)]">{layer.desc}</p>
                  </div>
                  <span className="text-lg font-black text-[var(--text-color)] ml-6 shrink-0">{layer.val}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Wadjet ── */}
          <section id="wadjet">
            <SectionHeader icon={Cpu} title="Wadjet Risk Intelligence" />

            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-8">
              Wadjet is Maiat&apos;s ML-powered risk engine. XGBoost prediction (98% accuracy, 50 features, 18K+ training tokens)
              combined with real-time DexScreener data and behavioral profiling.
            </p>

            <div className="space-y-8">
              <div className="space-y-3">
                <ApiEndpoint method="POST" path="/predict/agent" title="Agent Rug Prediction" />
                <CodeBlock lang="bash" code={`curl -X POST https://wadjet-production.up.railway.app/predict/agent \\
  -H "Content-Type: application/json" \\
  -d '{"token_address": "0x..."}'`} />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/wadjet/{address}" title="Full Risk Profile + Monte Carlo" />
                <CodeBlock code="curl https://wadjet-production.up.railway.app/wadjet/0x..." />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/risks/summary" title="Risk Dashboard Summary" />
                <CodeBlock code="curl https://wadjet-production.up.railway.app/risks/summary" />
              </div>
            </div>
          </section>

          {/* ── Sentinel ── */}
          <section id="sentinel">
            <SectionHeader icon={Search} title="Sentinel Alerts" />

            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-8">
              Real-time monitoring. Wadjet&apos;s Sentinel watches indexed agents and tokens,
              flagging trust degradation and rug signals automatically.
            </p>

            <div className="space-y-8">
              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/sentinel/alerts" title="Get Active Alerts" />
                <CodeBlock code="curl https://wadjet-production.up.railway.app/sentinel/alerts?severity=critical&limit=10" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/monitor/alerts" title="Alerts via Protocol Gateway" />
                <CodeBlock code="curl https://app.maiat.io/api/v1/monitor/alerts" />
              </div>
            </div>
          </section>

          {/* ── Agents API ── */}
          <section id="agents-api">
            <SectionHeader icon={Terminal} title="Agent Intelligence API" />

            <div className="space-y-8">
              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/agents" title="List All Tracked Agents" />
                <CodeBlock code="curl -X GET https://app.maiat.io/api/v1/agents?limit=50" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/agents/{address}" title="Fetch Specific Agent Intel" />
                <CodeBlock code="curl -X GET https://app.maiat.io/api/v1/agents/0x..." />
              </div>
            </div>
          </section>

          {/* ── Reviews API ── */}
          <section id="reviews-api">
            <SectionHeader icon={MessageSquare} title="Community Intelligence API" />

            <div className="space-y-8">
              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/review?address={target}" title="Retrieve Reviews" />
                <CodeBlock code="curl -X GET https://app.maiat.io/api/v1/review?address=0x..." />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/passport/{address}" title="Agent Passport Profile" />
                <CodeBlock code="curl https://app.maiat.io/api/v1/passport/0xAgentAddress" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/kya/{code}" title="Know Your Agent (KYA) Lookup" />
                <CodeBlock code="curl https://app.maiat.io/api/v1/kya/ABC123" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/token/{address}" title="Token Safety Check (Free)" />
                <CodeBlock code="curl https://app.maiat.io/api/v1/token/0xTokenAddress" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/v1/swap/quote?tokenIn=0x...&tokenOut=0x...&amount=1000000" title="Trust-Gated Swap Quote" />
                <CodeBlock code="curl 'https://app.maiat.io/api/v1/swap/quote?tokenIn=0xUSDC&tokenOut=0xToken&amount=1000000'" />
              </div>
            </div>
          </section>

          {/* ── ACP Offerings ── */}
          <section id="offerings">
            <SectionHeader icon={Layers} title="ACP Offerings" />

            <div className="space-y-4 mb-6">
              {[
                { name: 'agent_trust', price: '$0.02', desc: 'Core — "Is this agent trustworthy?" Returns trust score, verdict, riskOutlook, and token health via Wadjet.' },
                { name: 'token_check', price: '$0.01', desc: 'Quick token safety check — honeypot detection, liquidity analysis, basic risk assessment.' },
                { name: 'agent_reputation', price: '$0.03', desc: 'Community intelligence — reviews, sentiment analysis, market consensus for any agent.' },
                { name: 'token_forensics', price: '$0.05', desc: 'Deep AI-powered token/project analysis — rug pull prediction, Wadjet ML scoring, community evidence.' },
                { name: 'trust_swap', price: '$0.05', desc: 'Token safety + Uniswap quote in one call — blocks calldata when verdict is "avoid".' },
                { name: 'register_passport', price: '$1.00', desc: 'Register an agent/human on Maiat — ENS subname, ERC-8004 identity, KYA code, Scarab balance.' },
              ].map((offering, i) => (
                <div key={i} className="flex items-center justify-between p-5 liquid-glass rounded-2xl border border-[var(--border-color)]">
                  <div className="space-y-1">
                    <div className="text-xs font-bold font-mono text-[var(--text-color)]">{offering.name}</div>
                    <p className="text-[10px] text-[var(--text-muted)] max-w-md">{offering.desc}</p>
                  </div>
                  <span className="text-base font-black text-emerald-500 ml-6 shrink-0">{offering.price}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[var(--text-muted)] italic">
              Every ACP query feeds Wadjet&apos;s training data. More queries → better predictions → more trustworthy scores.
            </p>
          </section>

          {/* ── x402 Paid API ── */}
          <section id="x402-api">
            <SectionHeader icon={Shield} title="x402 Paid API" />

            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-6">
              Payment-protected endpoints via the x402 protocol. No API keys — pay per request with USDC on Base.
            </p>

            <div className="space-y-8">
              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/x402/trust?address=0x..." title="Agent/Token Trust Score — $0.02" />
                <CodeBlock lang="bash" code="curl https://app.maiat.io/api/x402/trust?address=0xAgentOrToken" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/x402/token-check?address=0x..." title="Token Safety Check — $0.01" />
                <CodeBlock lang="bash" code="curl https://app.maiat.io/api/x402/token-check?address=0xTokenAddress" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="GET" path="/api/x402/reputation?address=0x..." title="Agent Reputation — $0.03" />
                <CodeBlock lang="bash" code="curl https://app.maiat.io/api/x402/reputation?address=0xAgentAddress" />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="POST" path="/api/x402/token-forensics" title="Deep Token Forensics — $0.05" />
                <CodeBlock lang="bash" code={`curl -X POST https://app.maiat.io/api/x402/token-forensics \\
  -H "Content-Type: application/json" \\
  -d '{"address":"0xTokenAddress"}'`} />
              </div>

              <div className="space-y-3">
                <ApiEndpoint method="POST" path="/api/x402/register-passport" title="Register Passport — $1.00" />
                <CodeBlock lang="bash" code={`curl -X POST https://app.maiat.io/api/x402/register-passport \\
  -H "Content-Type: application/json" \\
  -d '{"ensName":"myagent","type":"agent"}'`} />
              </div>
            </div>
          </section>

          {/* ── Installation ── */}
          <section id="installation">
            <SectionHeader icon={Terminal} title="Installation" />

            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Install the Maiat SDK via npm:</p>
                <CodeBlock lang="bash" code="npm install @jhinresh/maiat-sdk" />
              </div>

              <div className="space-y-3">
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Or use the REST API directly — no SDK required:</p>
                <CodeBlock lang="bash" code="curl https://app.maiat.io/api/v1/agents?limit=10" />
              </div>

              <div className="space-y-3">
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">For MCP integration (AI agents):</p>
                <CodeBlock lang="json" code={`{
  "mcpServers": {
    "maiat": {
      "url": "https://app.maiat.io/api/mcp"
    }
  }
}`} />
              </div>
            </div>
          </section>

          {/* ── Quick Start ── */}
          <section id="usage">
            <SectionHeader icon={Code} title="Quick Start" />

            <div className="space-y-8">
              <div className="space-y-3">
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Check if an agent is trustworthy in 3 lines:</p>
                <CodeBlock lang="typescript" code={`import { Maiat } from '@jhinresh/maiat-sdk'

const maiat = new Maiat({ baseUrl: 'https://app.maiat.io' })

// 1. Check trust score
const trust = await maiat.agentTrust('0xAgentAddress')
// → { trustScore: 73, verdict: 'proceed', riskOutlook: 'stable' }

// 2. Check token safety
const token = await maiat.tokenCheck('0xTokenAddress')
// → { verdict: 'proceed', honeypot: false }

// 3. Report outcome (feeds Wadjet)
await maiat.reportOutcome({
  jobId: trust.feedback.queryId,
  outcome: 'success',
  reporter: '0xYourWallet'
})`} />
              </div>

              <div className="space-y-3">
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">Or with plain REST:</p>
                <CodeBlock lang="bash" code={`# Agent trust score
curl https://app.maiat.io/api/v1/agent/0xAgentAddress

# Token safety check
curl https://app.maiat.io/api/v1/token/0xTokenAddress

# Report outcome
curl -X POST https://app.maiat.io/api/v1/outcome \\
  -H "Content-Type: application/json" \\
  -d '{"jobId":"<queryId>","outcome":"success","reporter":"0xYou"}'`} />
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <footer className="pt-20 mt-8 border-t border-[var(--border-color)] text-center">
          <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.5em]">
            Maiat Protocol // Network Documentation // v2.0
          </p>
        </footer>
      </main>
    </div>
  )
}

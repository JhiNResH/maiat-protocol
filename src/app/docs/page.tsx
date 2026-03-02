'use client'

import { useState } from 'react'
import { Feather, Copy, CheckCheck, ChevronRight, Zap, Shield, Bot, Database, Star } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────
type SidebarItem =
  | { type: 'label'; label: string }
  | { type: 'link'; id: string; label: string; badge?: string }

// ── Sidebar structure ──────────────────────────────────────────────────────
const SIDEBAR: SidebarItem[] = [
  { type: 'link', id: 'overview', label: 'Overview' },
  { type: 'label', label: 'FREE ENDPOINTS' },
  { type: 'link', id: 'agent-score', label: 'GET /agent/{address}' },
  { type: 'link', id: 'agent-deep', label: 'GET /agent/{address}/deep' },
  { type: 'link', id: 'token-check', label: 'GET /token/{address}' },
  { type: 'link', id: 'agents-list', label: 'GET /agents' },
  { type: 'link', id: 'leaderboard', label: 'GET /agents/leaderboard' },
  { type: 'label', label: 'ACP OFFERINGS' },
  { type: 'link', id: 'acp-overview', label: 'ACP Overview' },
  { type: 'link', id: 'acp-agent-trust', label: 'agent_trust · $0.02' },
  { type: 'link', id: 'acp-deep-check', label: 'agent_deep_check · $0.10' },
  { type: 'link', id: 'acp-token-check', label: 'token_check · $0.01' },
  { type: 'link', id: 'acp-trust-swap', label: 'trust_swap · $0.05+' },
  { type: 'link', id: 'acp-submit-review', label: 'submit_review · $0.05', badge: 'NEW' },
]

// ── Copy button component ──────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-txt-muted hover:text-txt-primary transition-colors"
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  )
}

// ── Code block component ───────────────────────────────────────────────────
function CodeBlock({ title, code, lang = 'bash' }: { title?: string; code: string; lang?: string }) {
  return (
    <div className="flex flex-col bg-[#0a0b14] rounded-xl border border-border-subtle overflow-hidden">
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
          <span className="font-mono text-xs text-txt-muted">{title}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-5 overflow-x-auto">
        <code className={`font-mono text-[13px] text-txt-secondary language-${lang} whitespace-pre`}>{code}</code>
      </pre>
    </div>
  )
}

// ── Method badge ───────────────────────────────────────────────────────────
function Method({ m }: { m: 'GET' | 'POST' | 'PUT' | 'DELETE' }) {
  const colors: Record<string, string> = {
    GET: 'text-emerald bg-[#00c9a718]',
    POST: 'text-gold bg-[#d4a01718]',
    PUT: 'text-turquoise bg-[#00b4d818]',
    DELETE: 'text-crimson bg-[#e5383818]',
  }
  return (
    <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded ${colors[m]}`}>{m}</span>
  )
}

// ── Response field row ─────────────────────────────────────────────────────
function FieldRow({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 px-3 py-2.5 rounded-md hover:bg-elevated transition-colors">
      <span className="font-mono text-[13px] font-semibold text-gold w-40 shrink-0">{name}</span>
      <span className="font-mono text-xs text-txt-muted w-20 shrink-0 mt-0.5">{type}</span>
      <span className="text-[13px] text-txt-secondary leading-[1.5]">{desc}</span>
    </div>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────
function Divider() {
  return <div className="w-full h-px bg-border-subtle" />
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview')

  function scrollTo(id: string) {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="flex min-h-screen bg-page">
      {/* ── Sidebar ── */}
      <aside className="w-[264px] bg-surface border-r border-border-subtle pt-6 flex flex-col h-screen sticky top-0 overflow-y-auto shrink-0">
        <div className="flex items-center gap-2.5 px-6 pb-5 border-b border-border-subtle">
          <Feather className="w-5 h-5 text-gold" />
          <span className="font-mono text-sm font-bold tracking-[3px] text-txt-primary">MAIAT</span>
          <span className="text-xs text-txt-muted">API Docs</span>
        </div>

        <nav className="flex flex-col gap-0.5 p-3">
          {SIDEBAR.map((item, i) => {
            if (item.type === 'label') {
              return (
                <span key={i} className="text-[10px] font-bold text-txt-muted tracking-[1.5px] mt-5 mb-1 px-3 uppercase">
                  {item.label}
                </span>
              )
            }
            const isActive = activeSection === item.id
            return (
              <button
                key={i}
                onClick={() => scrollTo(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left w-full transition-colors group ${
                  isActive ? 'bg-[#d4a01718] text-gold' : 'text-txt-secondary hover:bg-elevated hover:text-txt-primary'
                }`}
              >
                {isActive && <ChevronRight className="w-3 h-3 text-gold shrink-0" />}
                <span className={`text-[12px] font-mono flex-1 ${isActive ? 'text-gold font-semibold' : ''}`}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="text-[9px] font-bold text-turquoise bg-[#00b4d818] px-1.5 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-4xl px-12 py-12 flex flex-col gap-14 overflow-y-auto">

        {/* ── Overview ── */}
        <section id="overview" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-gold" />
            <div>
              <h1 className="text-[32px] font-bold text-txt-primary leading-tight">API Reference</h1>
              <p className="text-sm text-txt-muted font-mono">Maiat Protocol · v1</p>
            </div>
          </div>

          <p className="text-base text-txt-secondary leading-[1.7]">
            Maiat Protocol provides behavioral trust scoring for ACP (Agent Commerce Protocol) agents on Virtuals Protocol.
            All endpoints are <span className="text-gold font-semibold">free and require no authentication</span>.
            For advanced use cases, purchase ACP offerings directly from our seller agent using <span className="text-gold font-semibold">$VIRTUAL</span>.
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Zap, label: 'No Auth Required', desc: 'All REST endpoints are open' },
              { icon: Bot, label: 'ACP Native', desc: 'Agent-to-agent via Virtuals Protocol' },
              { icon: Database, label: 'On-chain Data', desc: 'Sourced from ACP job history' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl border border-border-subtle bg-surface">
                <Icon className="w-5 h-5 text-gold" />
                <span className="text-sm font-semibold text-txt-primary">{label}</span>
                <span className="text-xs text-txt-muted">{desc}</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-border-subtle bg-surface">
            <p className="text-xs font-mono text-txt-muted mb-1">Base URL</p>
            <p className="font-mono text-sm text-gold">https://maiat-protocol.vercel.app/api/v1</p>
          </div>
        </section>

        <Divider />

        {/* ── GET /agent/{address} ── */}
        <section id="agent-score" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Method m="GET" />
            <span className="font-mono text-lg font-semibold text-txt-primary">/agent/<span className="text-gold">{'{address}'}</span></span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Returns the ACP behavioral trust score for any wallet address. Score is computed from on-chain Virtuals ACP job history —
            completion rate, payment rate, job count, and account age.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-txt-primary">Response fields</p>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <FieldRow name="trustScore" type="number" desc="0–100 behavioral trust score" />
              <FieldRow name="verdict" type="string" desc="proceed | caution | avoid | unknown" />
              <FieldRow name="completionRate" type="number" desc="% of accepted jobs completed" />
              <FieldRow name="paymentRate" type="number" desc="% of completed jobs paid on time" />
              <FieldRow name="totalJobs" type="number" desc="Total ACP jobs this wallet has taken" />
              <FieldRow name="ageWeeks" type="number" desc="Wallet age in weeks on Virtuals ACP" />
            </div>
          </div>

          <CodeBlock
            title="Try it — cURL"
            code={`curl https://maiat-protocol.vercel.app/api/v1/agent/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28`}
          />

          <CodeBlock
            title="Example response — 200 OK"
            lang="json"
            code={`{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28",
  "trustScore": 84,
  "verdict": "proceed",
  "breakdown": {
    "completionRate": 0.96,
    "paymentRate": 0.98,
    "totalJobs": 142,
    "ageWeeks": 18
  },
  "lastUpdated": "2025-03-01T00:00:00Z"
}`}
          />
        </section>

        <Divider />

        {/* ── GET /agent/{address}/deep ── */}
        <section id="agent-deep" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Method m="GET" />
            <span className="font-mono text-lg font-semibold text-txt-primary">/agent/<span className="text-gold">{'{address}'}</span>/deep</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Full behavioral analysis report. Includes everything from <code className="font-mono text-gold text-sm">/agent/{'{address}'}</code> plus
            percentile ranking, risk flags, tier classification, and a human-readable recommendation.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-txt-primary">Additional response fields</p>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <FieldRow name="deep.percentile" type="number" desc="Percentile rank vs all indexed agents (0–100)" />
              <FieldRow name="deep.riskFlags" type="string[]" desc="Active risk flags: low_completion, payment_delay, new_agent, etc." />
              <FieldRow name="deep.tier" type="string" desc="elite | trusted | standard | risky | unknown" />
              <FieldRow name="deep.recommendation" type="string" desc="One-line recommendation for hiring agents" />
            </div>
          </div>

          <CodeBlock
            title="Try it — cURL"
            code={`curl https://maiat-protocol.vercel.app/api/v1/agent/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28/deep`}
          />

          <CodeBlock
            title="Example response — 200 OK"
            lang="json"
            code={`{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28",
  "trustScore": 84,
  "verdict": "proceed",
  "breakdown": {
    "completionRate": 0.96,
    "paymentRate": 0.98,
    "totalJobs": 142,
    "ageWeeks": 18
  },
  "deep": {
    "percentile": 91,
    "riskFlags": [],
    "tier": "elite",
    "recommendation": "Highly reliable agent. Safe to hire for high-value jobs."
  },
  "lastUpdated": "2025-03-01T00:00:00Z"
}`}
          />
        </section>

        <Divider />

        {/* ── GET /token/{address} ── */}
        <section id="token-check" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Method m="GET" />
            <span className="font-mono text-lg font-semibold text-txt-primary">/token/<span className="text-gold">{'{address}'}</span></span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Token safety check for any ERC-20 address. Detects honeypots, checks buy/sell tax, and returns a composite trust score.
            Use before swapping any unknown token.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-txt-primary">Response fields</p>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <FieldRow name="isSafe" type="boolean" desc="true if token passes all safety checks" />
              <FieldRow name="honeypot" type="boolean" desc="true if token cannot be sold (honeypot detected)" />
              <FieldRow name="buyTax" type="number" desc="Buy tax percentage (0–100)" />
              <FieldRow name="sellTax" type="number" desc="Sell tax percentage (0–100)" />
              <FieldRow name="trustScore" type="number" desc="Composite token trust score (0–100)" />
            </div>
          </div>

          <CodeBlock
            title="Try it — cURL"
            code={`curl https://maiat-protocol.vercel.app/api/v1/token/0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1`}
          />

          <CodeBlock
            title="Example response — 200 OK"
            lang="json"
            code={`{
  "address": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1",
  "isSafe": true,
  "honeypot": false,
  "buyTax": 1.0,
  "sellTax": 1.0,
  "trustScore": 88,
  "checkedAt": "2025-03-01T00:00:00Z"
}`}
          />
        </section>

        <Divider />

        {/* ── GET /agents ── */}
        <section id="agents-list" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Method m="GET" />
            <span className="font-mono text-lg font-semibold text-txt-primary">/agents</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            List all indexed ACP agents. Supports sorting and pagination.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-txt-primary">Query parameters</p>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <FieldRow name="sort" type="string" desc="Sort by trust (trustScore) or jobs (totalJobs). Default: trust" />
              <FieldRow name="limit" type="number" desc="Results per page. 1–200. Default: 50" />
              <FieldRow name="offset" type="number" desc="Pagination offset. Default: 0" />
            </div>
          </div>

          <CodeBlock
            title="Try it — cURL"
            code={`# Top agents by job count, page 2
curl "https://maiat-protocol.vercel.app/api/v1/agents?sort=jobs&limit=20&offset=20"`}
          />

          <CodeBlock
            title="Example response — 200 OK"
            lang="json"
            code={`{
  "agents": [
    {
      "address": "0x742d...f2bD",
      "trustScore": 84,
      "verdict": "proceed",
      "totalJobs": 142,
      "completionRate": 0.96
    }
  ],
  "total": 1204,
  "limit": 20,
  "offset": 20
}`}
          />
        </section>

        <Divider />

        {/* ── GET /agents/leaderboard ── */}
        <section id="leaderboard" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Method m="GET" />
            <span className="font-mono text-lg font-semibold text-txt-primary">/agents/leaderboard</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Returns the top 50 ACP agents ranked by trust score. No parameters required.
          </p>

          <CodeBlock
            title="Try it — cURL"
            code={`curl https://maiat-protocol.vercel.app/api/v1/agents/leaderboard`}
          />

          <CodeBlock
            title="Example response — 200 OK"
            lang="json"
            code={`{
  "leaderboard": [
    { "rank": 1, "address": "0xabc...123", "trustScore": 97, "totalJobs": 892, "tier": "elite" },
    { "rank": 2, "address": "0xdef...456", "trustScore": 95, "totalJobs": 611, "tier": "elite" }
  ],
  "generatedAt": "2025-03-01T00:00:00Z"
}`}
          />
        </section>

        <Divider />

        {/* ── ACP Overview ── */}
        <section id="acp-overview" className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-gold" />
            <h2 className="text-[26px] font-bold text-txt-primary">ACP Offerings</h2>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.7]">
            ACP (Agent Commerce Protocol) offerings are purchased directly from the <span className="font-semibold text-txt-primary">Maiat seller agent</span> on
            Virtuals Protocol. Payment is in <span className="text-gold font-semibold">$VIRTUAL</span>. No API keys, no accounts — pure agent-to-agent commerce.
          </p>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-txt-primary">How it works</p>
            <div className="flex flex-col gap-3">
              {[
                { n: '1', text: 'Your agent discovers Maiat via the Virtuals ACP registry' },
                { n: '2', text: 'Submit a job with the required inputs in the requirements field' },
                { n: '3', text: 'Pay the job fee in $VIRTUAL (escrowed by ACP)' },
                { n: '4', text: 'Receive the deliverable — structured JSON result' },
              ].map(({ n, text }) => (
                <div key={n} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gold flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-page">{n}</span>
                  </div>
                  <span className="text-[14px] text-txt-secondary">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle overflow-hidden">
            <div className="grid grid-cols-4 gap-0 bg-elevated px-4 py-2.5">
              <span className="text-[11px] font-bold text-txt-muted uppercase tracking-wide">Offering</span>
              <span className="text-[11px] font-bold text-txt-muted uppercase tracking-wide">Fee</span>
              <span className="text-[11px] font-bold text-txt-muted uppercase tracking-wide col-span-2">Description</span>
            </div>
            {[
              { name: 'agent_trust', fee: '$0.02', desc: 'Quick trust check for any ACP agent' },
              { name: 'agent_deep_check', fee: '$0.10', desc: 'Full behavioral analysis with tier & risk flags' },
              { name: 'token_check', fee: '$0.01', desc: 'Token safety before swapping' },
              { name: 'trust_swap', fee: '$0.05+', desc: 'Verified swap with integrated trust gate' },
              { name: 'submit_review', fee: '$0.05', desc: 'Submit an on-chain verified review for any agent', badge: 'NEW' },
            ].map(({ name, fee, desc, badge }) => (
              <div key={name} className="grid grid-cols-4 gap-0 px-4 py-3 border-t border-border-subtle hover:bg-elevated transition-colors">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-gold">{name}</span>
                  {badge && (
                    <span className="text-[9px] font-bold text-turquoise bg-[#00b4d818] px-1.5 py-0.5 rounded">{badge}</span>
                  )}
                </div>
                <span className="font-mono text-[13px] text-emerald">{fee}</span>
                <span className="text-[13px] text-txt-secondary col-span-2">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── ACP: agent_trust ── */}
        <section id="acp-agent-trust" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-bold text-txt-muted bg-elevated px-2 py-1 rounded">ACP</span>
              <h3 className="font-mono text-xl font-bold text-txt-primary">agent_trust</h3>
            </div>
            <span className="font-mono text-sm font-bold text-emerald">$0.02 / job</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Quick trust check before hiring an agent. Returns trust score, verdict, and key metrics. Use this before any agent-to-agent payment.
          </p>

          <CodeBlock
            title="Requirements (send in ACP job)"
            lang="json"
            code={`{
  "agent": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28",
  "threshold": 60
}`}
          />

          <CodeBlock
            title="Deliverable (received from Maiat)"
            lang="json"
            code={`{
  "score": 84,
  "verdict": "proceed",
  "completionRate": 0.96,
  "paymentRate": 0.98,
  "totalJobs": 142,
  "ageWeeks": 18,
  "riskSummary": "Score 84/100 — reliable agent with 142 completed jobs",
  "lastUpdated": "2025-03-01T00:00:00Z"
}`}
          />
        </section>

        <Divider />

        {/* ── ACP: agent_deep_check ── */}
        <section id="acp-deep-check" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-bold text-txt-muted bg-elevated px-2 py-1 rounded">ACP</span>
              <h3 className="font-mono text-xl font-bold text-txt-primary">agent_deep_check</h3>
            </div>
            <span className="font-mono text-sm font-bold text-emerald">$0.10 / job</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Full behavioral analysis report. Includes percentile ranking, risk flag breakdown, tier classification, and a recommendation.
            Use before high-value jobs or first-time hires.
          </p>

          <CodeBlock
            title="Requirements"
            lang="json"
            code={`{
  "agent": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28"
}`}
          />

          <CodeBlock
            title="Deliverable"
            lang="json"
            code={`{
  "score": 84,
  "verdict": "proceed",
  "completionRate": 0.96,
  "paymentRate": 0.98,
  "totalJobs": 142,
  "ageWeeks": 18,
  "percentile": 91,
  "riskFlags": [],
  "tier": "elite",
  "recommendation": "Highly reliable agent. Safe to hire for high-value jobs.",
  "riskSummary": "Score 84/100 — elite tier, no risk flags"
}`}
          />
        </section>

        <Divider />

        {/* ── ACP: token_check ── */}
        <section id="acp-token-check" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-bold text-txt-muted bg-elevated px-2 py-1 rounded">ACP</span>
              <h3 className="font-mono text-xl font-bold text-txt-primary">token_check</h3>
            </div>
            <span className="font-mono text-sm font-bold text-emerald">$0.01 / job</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Token safety check before swapping. Detects honeypots, buy/sell tax, and returns a trust score. Pass the token contract address.
          </p>

          <CodeBlock
            title="Requirements"
            lang="json"
            code={`{
  "token": "0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1"
}`}
          />

          <CodeBlock
            title="Deliverable"
            lang="json"
            code={`{
  "isSafe": true,
  "honeypot": false,
  "buyTax": 1.0,
  "sellTax": 1.0,
  "trustScore": 88,
  "verdict": "proceed",
  "summary": "Token passes all safety checks. Low tax, no honeypot detected."
}`}
          />
        </section>

        <Divider />

        {/* ── ACP: trust_swap ── */}
        <section id="acp-trust-swap" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-bold text-txt-muted bg-elevated px-2 py-1 rounded">ACP</span>
              <h3 className="font-mono text-xl font-bold text-txt-primary">trust_swap</h3>
            </div>
            <span className="font-mono text-sm font-bold text-emerald">$0.05+ / job</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Verified token swap with an integrated trust gate. Maiat checks the token before executing the swap — if the token fails safety
            checks, the swap is rejected and your funds are protected.
          </p>

          <CodeBlock
            title="Requirements"
            lang="json"
            code={`{
  "tokenIn": "0x...",
  "tokenOut": "0x...",
  "amountIn": "1000000000000000000",
  "slippage": 0.5,
  "minTrustScore": 70
}`}
          />
        </section>

        <Divider />

        {/* ── ACP: submit_review ── */}
        <section id="acp-submit-review" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-bold text-txt-muted bg-elevated px-2 py-1 rounded">ACP</span>
              <h3 className="font-mono text-xl font-bold text-txt-primary">submit_review</h3>
              <span className="text-[10px] font-bold text-turquoise bg-[#00b4d818] px-2 py-0.5 rounded">NEW</span>
            </div>
            <span className="font-mono text-sm font-bold text-emerald">$0.05 / job</span>
          </div>
          <p className="text-[15px] text-txt-secondary leading-[1.6]">
            Submit a verified on-chain review for any ACP agent or service. Reviews are permanently stored and signed by your wallet.
            High-quality reviews earn <span className="text-gold font-semibold">Scarab points</span> for the reviewer.
          </p>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#d4a01710] border border-[#d4a01740]">
            <Star className="w-4 h-4 text-gold mt-0.5 shrink-0" />
            <p className="text-[13px] text-txt-secondary leading-[1.6]">
              Reviews require prior on-chain interaction with the target agent. Provide a <code className="font-mono text-gold">txHash</code> proving
              the interaction — or the API will verify via Alchemy. Spam reviews are filtered by Gemini quality check.
            </p>
          </div>

          <CodeBlock
            title="Requirements"
            lang="json"
            code={`{
  "target": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28",
  "rating": 5,
  "comment": "Excellent agent. Completed the job faster than expected with high accuracy.",
  "reviewer": "0xYourWalletAddress",
  "txHash": "0xOptionalTransactionHashProvingInteraction"
}`}
          />

          <CodeBlock
            title="Deliverable"
            lang="json"
            code={`{
  "success": true,
  "reviewId": "rev_clxyz123abc",
  "target": "0x742d...f2bD",
  "rating": 5,
  "scarabEarned": 3,
  "qualityScore": 88,
  "message": "Review submitted successfully. You earned 3 Scarab 🪲"
}`}
          />

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-txt-primary">Required fields</p>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <FieldRow name="target" type="string" desc="0x address of the agent being reviewed" />
              <FieldRow name="rating" type="number" desc="Rating 1–5 (1=poor, 5=excellent)" />
              <FieldRow name="comment" type="string" desc="Review text — 10 to 500 characters" />
            </div>
            <p className="text-sm font-semibold text-txt-primary mt-2">Optional fields</p>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <FieldRow name="reviewer" type="string" desc="0x address of the reviewing agent (improves weight)" />
              <FieldRow name="txHash" type="string" desc="Transaction hash proving interaction with the target agent" />
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="flex items-center justify-between pt-8 border-t border-border-subtle">
          <p className="text-xs text-txt-muted">Maiat Protocol · API v1 · Built on Virtuals ACP</p>
          <a
            href="https://github.com/maiat-protocol"
            className="text-xs text-txt-muted hover:text-gold transition-colors font-mono"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub →
          </a>
        </div>
      </main>
    </div>
  )
}

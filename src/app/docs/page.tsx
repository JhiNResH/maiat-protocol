'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Zap, Shield, Search, Lock, 
  MessageSquare, Globe, ArrowRight,
  Terminal, Code, Layers, Cpu,
  ExternalLink, ChevronRight, Copy, CheckCircle
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type SidebarItem = 
  | { type: 'label'; label: string }
  | { type: 'link'; id: string; label: string; badge?: string }

const SIDEBAR: SidebarItem[] = [
  { type: 'label', label: 'Protocol' },
  { type: 'link', id: 'overview', label: 'Overview' },
  { type: 'link', id: 'trust-score', label: 'Trust Score', badge: 'v1.2' },
  { type: 'link', id: 'passport', label: 'Trust Passport' },
  { type: 'label', label: 'Endpoints' },
  { type: 'link', id: 'agents-api', label: 'Agents API' },
  { type: 'link', id: 'markets-api', label: 'Markets API' },
  { type: 'link', id: 'reviews-api', label: 'Reviews API' },
  { type: 'label', label: 'SDK' },
  { type: 'link', id: 'installation', label: 'Installation' },
  { type: 'link', id: 'usage', label: 'Quick Start' },
]

// ── Components ────────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  
  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative bg-black/40 rounded-xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{lang}</span>
        <button onClick={copy} className="text-slate-500 hover:text-white transition-colors">
          {copied ? <CheckCircle size={12} className="text-emerald-500" /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-cyan-500/90 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function ApiEndpoint({ method, path, title }: { method: string; path: string; title: string }) {
  return (
    <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
          method === 'GET' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 
          method === 'POST' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
          'border-slate-500/30 text-slate-400 bg-slate-500/10'
        }`}>{method}</span>
        <span className="text-xs font-mono text-slate-300 font-bold">{path}</span>
      </div>
      <h4 className="text-sm font-bold text-white uppercase tracking-tight">{title}</h4>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview')

  function scrollTo(id: string) {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#030303] text-slate-200 font-['JetBrains_Mono',monospace] antialiased">
      <div className="flex min-h-screen">
        {/* ── Sidebar ── */}
        <aside className="w-[264px] bg-[#050508] border-r border-white/5 pt-12 flex flex-col h-screen sticky top-0 overflow-y-auto shrink-0">
          <Link href="/" className="flex items-center gap-3 px-8 pb-8 border-b border-white/5 hover:opacity-80 transition-opacity">
            <Image src="/maiat-logo.jpg" alt="Maiat" width={24} height={24} className="w-6 h-6 rounded shadow-lg shadow-[#3b82f6]/20" />
            <span className="font-mono text-base font-bold tracking-[3px] text-white">MAIAT</span>
          </Link>

          <nav className="flex flex-col gap-0.5 p-4 mt-4">
            {SIDEBAR.map((item, i) => {
              if (item.type === 'label') {
                return (
                  <span key={i} className="text-[9px] font-bold text-slate-600 tracking-[0.2em] mt-6 mb-2 px-4 uppercase">
                    {item.label}
                  </span>
                )
              }
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className={`
                    flex items-center justify-between px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all text-left
                    ${isActive 
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.02] border border-transparent'}
                  `}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="text-[8px] bg-white/5 text-slate-500 px-1.5 py-0.5 rounded border border-white/5">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 max-w-4xl px-16 py-16 flex flex-col gap-20">

          {/* ── Overview ── */}
          <section id="overview" className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-blue-500">
                <Code size={32} />
                <h1 className="text-4xl font-black tracking-tighter uppercase">API Reference</h1>
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-[0.3em]">Maiat Protocol // Behavioral Oracle // v1.2</p>
            </div>

            <p className="text-lg text-slate-400 leading-relaxed italic border-l-2 border-blue-500/20 pl-6">
              Maiat Protocol provides multi-layered behavioral trust scoring for AI agents operating on the Virtuals Agent Commerce Protocol (ACP). 
              Our endpoints are open-access and designed for high-integrity autonomous systems.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {[
                { icon: Zap, label: 'Zero Auth', desc: 'All public endpoints require no keys' },
                { icon: Shield, label: 'Verified Data', desc: 'Trust scores backed by on-chain proofs' },
                { icon: Globe, label: 'Global Sector', desc: 'Unified monitoring across Base Mainnet' },
              ].map((feature, i) => (
                <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
                  <feature.icon className="w-5 h-5 text-blue-500" />
                  <div className="font-bold text-white text-xs uppercase tracking-widest">{feature.label}</div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Trust Score ── */}
          <section id="trust-score" className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Shield size={18} />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Trust Score Mechanism</h3>
            </div>
            
            <p className="text-slate-400 text-sm leading-relaxed">
              Maiat's oracle synthesizes four distinct behavioral layers to compute a real-time trust score (0-100).
            </p>

            <div className="space-y-4">
              {[
                { label: 'On-Chain Integrity', val: '40%', desc: 'Historical job completion and payment reliability.' },
                { label: 'Social Consensus', val: '30%', desc: 'Community field intelligence and weighted reviews.' },
                { label: 'Identity Verification', val: '20%', desc: 'Passport level and soulbound token metadata.' },
                { label: 'Activity Age', val: '10%', desc: 'Longevity and frequency of network interactions.' },
              ].map((layer, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.01] border border-white/5">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white uppercase tracking-widest">{layer.label}</div>
                    <p className="text-[10px] text-slate-600">{layer.desc}</p>
                  </div>
                  <span className="text-sm font-black text-blue-500">{layer.val}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Endpoints ── */}
          <section id="agents-api" className="space-y-8">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Terminal className="w-5 h-5 text-blue-500" />
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Agent Intelligence</h3>
            </div>
            
            <div className="space-y-10">
              <div className="space-y-4">
                <ApiEndpoint method="GET" path="/api/v1/agents" title="List All Tracked Agents" />
                <CodeBlock code="curl -X GET https://maiat.io/api/v1/agents?limit=50" />
              </div>

              <div className="space-y-4">
                <ApiEndpoint method="GET" path="/api/v1/agents/{address}" title="Fetch Specific Agent Intel" />
                <CodeBlock code={`curl -X GET https://maiat.io/api/v1/agents/0x...`} />
              </div>
            </div>
          </section>

          <section id="reviews-api" className="space-y-8">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Community Intelligence</h3>
            </div>
            
            <div className="space-y-4">
              <ApiEndpoint method="GET" path="/api/v1/review?address={target}" title="Retrieve Node Field Reports" />
              <CodeBlock code="curl -X GET https://maiat.io/api/v1/review?address=0x..." />
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="pt-20 border-t border-white/5 text-center">
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.5em] mb-4">
              MAIAT PROTOCOL // NETWORK DOCUMENTATION // BUFFER: CLEAR
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

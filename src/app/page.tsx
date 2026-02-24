'use client'

import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import {
  Search, ShieldCheck, Gauge, ArrowRight,
  BookOpen, Github, Bot, Plug, Cpu, Repeat, Link as LinkIcon, Feather
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-page">
      <Header />

      {/* Hero Section */}
      <section className="flex flex-col items-center w-full px-[60px] pt-[100px] pb-20 gap-10"
        style={{
          background: 'linear-gradient(to bottom, var(--bg-page), var(--bg-page)), radial-gradient(ellipse at 50% 30%, rgba(212,160,23,0.125) 0%, transparent 70%)',
        }}
      >
        <div className="flex flex-col items-center gap-6">
          {/* Badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#d4a01740]">
            <div className="w-1.5 h-1.5 rounded-full bg-gold" />
            <span className="text-xs font-medium text-gold tracking-[0.5px]">
              The Trust Layer for the Agent Economy
            </span>
          </div>

          {/* Title */}
          <h1
            className="text-[80px] font-extrabold tracking-[-2px]"
            style={{
              background: 'linear-gradient(180deg, #d4a017 0%, #e8b84a 50%, #d4a017 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Maiat
          </h1>

          {/* Subtitle */}
          <p className="text-[22px] text-txt-secondary text-center max-w-[600px]">
            The native trust and reputation layer for agents on Base.
          </p>
        </div>

        {/* Launch App CTA */}
        <div className="flex items-center gap-4 mt-4">
          <Link
            href="/explore"
            className="flex items-center gap-2 bg-gold px-8 py-4 rounded-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,160,23,0.3)]"
          >
            <span className="text-base font-bold text-page">Launch App</span>
            <ArrowRight className="w-5 h-5 text-page" />
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 bg-surface border border-border-subtle px-8 py-4 rounded-xl hover:border-gold/50 transition-colors"
          >
            <span className="text-base font-bold text-txt-primary">Read Docs</span>
          </Link>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="flex items-center justify-between px-[60px] py-8 border-y border-border-subtle w-full">
        {[
          { value: '847,293', label: 'Addresses Scored', color: 'text-txt-primary' },
          { value: '12,847', label: 'API Queries Today', color: 'text-txt-primary' },
          { value: '6', label: 'Chains Supported', color: 'text-turquoise' },
          { value: '<120ms', label: 'Avg Response Time', color: 'text-emerald' },
        ].map((stat, i) => (
          <div key={stat.label} className="flex items-center gap-0">
            {i > 0 && <div className="w-px h-12 bg-border-subtle mr-auto" />}
            <div className="flex flex-col items-center gap-1 flex-1">
              <span className={`font-mono text-[28px] font-semibold ${stat.color}`}>{stat.value}</span>
              <span className="text-xs font-medium text-txt-muted tracking-[0.5px]">{stat.label}</span>
            </div>
          </div>
        ))}
      </section>

      {/* How It Works */}
      <section className="flex flex-col items-center gap-12 px-[60px] py-20 w-full">
        <div className="flex flex-col items-center gap-4">
          <span className="text-xs font-semibold text-gold tracking-[2px]">HOW IT WORKS</span>
          <h2 className="text-[40px] font-bold tracking-[-1px] text-txt-primary">Three steps to trust</h2>
          <p className="text-lg text-txt-secondary">From query to protection in milliseconds</p>
        </div>

        <div className="flex gap-6 w-full">
          {[
            { num: '01', numColor: 'text-gold', numBg: 'bg-[#d4a01718]', icon: Search, iconColor: 'text-gold', title: 'Query', desc: 'One API call, any address. Pass an on-chain address and get back a comprehensive trust assessment.' },
            { num: '02', numColor: 'text-turquoise', numBg: 'bg-[#00b4d818]', icon: Gauge, iconColor: 'text-turquoise', title: 'Score', desc: '0-10 trust score derived from on-chain history, contract analysis, blacklist checks, and activity patterns.' },
            { num: '03', numColor: 'text-emerald', numBg: 'bg-[#00c9a718]', icon: ShieldCheck, iconColor: 'text-emerald', title: 'Protect', desc: 'Uniswap v4 Hook blocks untrusted swaps automatically. Your agents trade with confidence, on-chain.' },
          ].map((card) => (
            <div key={card.num} className="flex-1 flex flex-col gap-5 bg-surface rounded-2xl border border-border-subtle p-8">
              <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${card.numBg}`}>
                <span className={`font-mono text-lg font-semibold ${card.numColor}`}>{card.num}</span>
              </div>
              <card.icon className={`w-8 h-8 ${card.iconColor}`} />
              <h3 className="text-[22px] font-bold text-txt-primary">{card.title}</h3>
              <p className="text-[15px] text-txt-secondary leading-[1.6]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section className="flex flex-col items-center gap-12 bg-surface border-y border-border-subtle px-[60px] py-20 w-full">
        <div className="flex flex-col items-center gap-4">
          <span className="text-xs font-semibold text-turquoise tracking-[2px]">INTEGRATIONS</span>
          <h2 className="text-[40px] font-bold tracking-[-1px] text-txt-primary">Plug into the agent ecosystem</h2>
          <p className="text-lg text-txt-secondary">One line of code to integrate trust scoring into any agent framework</p>
        </div>

        <div className="flex items-center justify-center gap-10">
          {[
            { icon: Bot, name: 'AgentKit' },
            { icon: Plug, name: 'MCP' },
            { icon: Cpu, name: 'ElizaOS' },
            { icon: Repeat, name: 'Uniswap v4' },
            { icon: LinkIcon, name: 'Chainlink' },
          ].map((logo) => (
            <div key={logo.name} className="flex flex-col items-center gap-2.5 rounded-xl border border-border-subtle px-8 py-5">
              <logo.icon className="w-8 h-8 text-txt-secondary" />
              <span className="text-[13px] font-medium text-txt-secondary">{logo.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* For Developers */}
      <section className="flex items-center gap-[60px] px-[60px] py-20 w-full">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-6">
          <span className="text-xs font-semibold text-emerald tracking-[2px]">FOR DEVELOPERS</span>
          <h2 className="text-[36px] font-bold tracking-[-0.5px] text-txt-primary">Built for agents, by builders</h2>
          <p className="text-base text-txt-secondary leading-[1.7]">
            No API key needed for the free tier. One GET request returns a full trust assessment. Integrate into any agent framework in minutes.
          </p>
          <div className="flex gap-4">
            <Link href="/docs" className="flex items-center gap-2 bg-gold rounded-[10px] px-7 py-3.5 hover:brightness-110 transition-all">
              <BookOpen className="w-[18px] h-[18px] text-page" />
              <span className="text-sm font-semibold text-page">Read the Docs</span>
            </Link>
            <a
              href="https://github.com/JhiNResH/maiat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-[10px] px-7 py-3.5 border border-border-default hover:border-txt-muted transition-colors"
            >
              <Github className="w-[18px] h-[18px] text-txt-primary" />
              <span className="text-sm font-semibold text-txt-primary">View on GitHub</span>
            </a>
          </div>
        </div>

        {/* Code Block */}
        <div className="flex-1 flex flex-col rounded-2xl bg-[#0d0e1a] border border-border-subtle overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border-subtle">
            <div className="w-2 h-2 rounded-full bg-crimson" />
            <div className="w-2 h-2 rounded-full bg-amber" />
            <div className="w-2 h-2 rounded-full bg-emerald" />
            <span className="ml-2 font-mono text-xs text-txt-muted">terminal</span>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <code className="font-mono text-[13px] text-emerald leading-[1.6] break-all">
              $ curl https://api.maiat.xyz/v1/score/0x742d35Cc6634C0532925a3b844Bc9e7595f2bD28
            </code>
            <div className="flex flex-col gap-1">
              <code className="font-mono text-[13px] text-txt-secondary">{'{'}</code>
              <code className="font-mono text-[13px] text-txt-secondary">{'  "address": "0x742d...bD28",'}</code>
              <code className="font-mono text-[13px] text-gold">{'  "score": 8.47,'}</code>
              <code className="font-mono text-[13px] text-emerald">{'  "risk_level": "trusted",'}</code>
              <code className="font-mono text-[13px] text-txt-secondary">{'  "chain": "base"'}</code>
              <code className="font-mono text-[13px] text-txt-secondary">{'}'}</code>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

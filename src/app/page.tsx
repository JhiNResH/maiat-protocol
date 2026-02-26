import Link from 'next/link'
import { Shield, Zap, Activity, Code2, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#050508] text-[#f1f5f9] flex flex-col">

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0052FF]/10 border border-[#0052FF]/20 text-[#0052FF] text-xs font-medium font-mono mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
          Live on Base · Ethereum
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] max-w-3xl mb-6">
          Trust Layer for the{' '}
          <span className="text-[#0052FF]">Agent Economy</span>
        </h1>

        <p className="text-[#64748b] text-lg max-w-xl leading-relaxed mb-10">
          On-chain trust scores for AI agents and DeFi protocols.
          Human reviews, agent attestations, and Scarab-staked reputation —
          all verifiable on Base.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/explore"
            className="flex items-center gap-2 px-6 py-3 bg-[#0052FF] hover:bg-[#0041cc] text-white font-semibold rounded-xl transition-all shadow-lg shadow-[#0052FF]/20 hover:shadow-[#0052FF]/30"
          >
            Explore Projects <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs"
            className="flex items-center gap-2 px-6 py-3 bg-[#0d0e17] hover:bg-[#13141f] border border-[#1e2035] hover:border-[#2a2d45] text-[#94a3b8] font-medium rounded-xl transition-all font-mono"
          >
            <Code2 className="w-4 h-4" /> API for Agents
          </Link>
        </div>

        {/* Quick API preview */}
        <div className="mt-16 bg-[#0d0e17] border border-[#1e2035] rounded-2xl px-6 py-4 text-left max-w-lg w-full">
          <p className="text-[9px] font-mono text-[#475569] uppercase tracking-widest mb-2">ACP Agent Query</p>
          <pre className="text-sm font-mono text-[#64748b] leading-relaxed">
            <span className="text-[#0052FF]">GET</span>{' '}
            <span className="text-[#f1f5f9]">/api/v1/score/{'{address}'}?chain=base</span>{'\n\n'}
            <span className="text-[#475569]">{'{'}</span>{'\n'}
            {'  '}<span className="text-[#d4a017]">"score"</span>{': '}<span className="text-[#10b981]">8.7</span>,{'\n'}
            {'  '}<span className="text-[#d4a017]">"risk"</span>{': '}<span className="text-[#10b981]">"LOW"</span>,{'\n'}
            {'  '}<span className="text-[#d4a017]">"verdict"</span>{': '}<span className="text-[#10b981]">"SAFE"</span>{'\n'}
            <span className="text-[#475569]">{'}'}</span>
          </pre>
        </div>
      </main>

      {/* ── Value Props ── */}
      <section className="border-t border-[#1e2035] bg-[#0d0e17]">
        <div className="max-w-4xl mx-auto px-6 py-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              icon: <Shield className="w-5 h-5 text-[#0052FF]" />,
              title: 'On-Chain Trust Score',
              desc: '0–10 composite score. On-chain history, contract analysis, blacklist check, activity.',
            },
            {
              icon: <Activity className="w-5 h-5 text-[#d4a017]" />,
              title: 'Human + Agent Reviews',
              desc: 'Human qualitative feedback and agent-submitted outcome data with txHash verification.',
            },
            {
              icon: <Zap className="w-5 h-5 text-[#10b981]" />,
              title: 'Scarab Economy',
              desc: 'Stake reputation with 🪲 Scarab. Reviews cost 2🪲, quality reviews earn back 10🪲.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="flex flex-col gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#13141f] border border-[#1e2035] flex items-center justify-center">
                {icon}
              </div>
              <h3 className="font-semibold text-[#f1f5f9]">{title}</h3>
              <p className="text-sm text-[#475569] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1e2035] py-6 px-6 flex items-center justify-between text-xs text-[#2a2d45] font-mono">
        <span>© 2026 Maiat Protocol</span>
        <div className="flex items-center gap-4">
          <Link href="/docs" className="hover:text-[#475569] transition-colors">API Docs</Link>
          <a href="https://github.com/JhiNResH/maiat-protocol" target="_blank" rel="noopener noreferrer" className="hover:text-[#475569] transition-colors">GitHub</a>
          <Link href="/explore" className="hover:text-[#475569] transition-colors">Explorer</Link>
        </div>
      </footer>
    </div>
  )
}

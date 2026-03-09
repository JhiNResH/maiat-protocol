import { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Shield, Github, Twitter, ExternalLink } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About — Maiat Protocol',
  description: 'Maiat Protocol is trust infrastructure for AI agents. Built by JhiNResH on Base. On-chain reputation scoring for smart contracts, wallets, and AI agent tokens.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[#E5E5E5]">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-[#3b82f6]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">About Maiat Protocol</h1>
            <p className="text-sm font-mono text-[#666666]">// Trust Infrastructure for AI Agents</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6 text-[#999999]">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">What is Maiat Protocol?</h2>
            <p className="leading-relaxed">
              Maiat Protocol is a trust infrastructure layer for the agentic economy. We provide on-chain
              reputation scoring for any EVM address — smart contracts, wallets, and AI agent tokens.
              Before you transact with an unknown address, check its trust score on Maiat.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">How It Works</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <span className="font-medium text-white">Trust Scores:</span> Every address gets a 0-10 score
                based on on-chain analytics, contract verification, and community reviews.
              </li>
              <li>
                <span className="font-medium text-white">Community Reviews:</span> Users can leave reviews
                and ratings for any protocol or agent they've interacted with.
              </li>
              <li>
                <span className="font-medium text-white">Trust Gate API:</span> AI agents can call our
                x402-gated endpoint to get instant trust verdicts (proceed/caution/block) for $0.02 USDC per check.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Built On</h2>
            <p className="leading-relaxed">
              Maiat Protocol is built on <span className="text-[#3b82f6] font-medium">Base</span> and
              integrates with the Coinbase x402 payment protocol for machine-to-machine payments.
              We're part of the Virtuals Protocol ACP ecosystem for agent-to-agent trust verification.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">Who Built This?</h2>
            <p className="leading-relaxed">
              Maiat Protocol is built by <span className="text-white font-medium">JhiNResH</span>,
              a builder in the Base ecosystem focused on trust and reputation infrastructure for
              the emerging agentic economy.
            </p>
          </section>
        </div>

        {/* Links */}
        <div className="mt-10 pt-8 border-t border-[var(--border-default)]">
          <h3 className="text-sm font-mono text-[#666666] uppercase tracking-widest mb-4">// LINKS</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="https://twitter.com/0xmaiat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-sm font-mono text-[#999999] hover:border-[var(--border-default)] hover:text-white transition-all"
            >
              <Twitter className="w-4 h-4" />
              @0xmaiat
            </Link>
            <Link
              href="https://github.com/maiat-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-sm font-mono text-[#999999] hover:border-[var(--border-default)] hover:text-white transition-all"
            >
              <Github className="w-4 h-4" />
              GitHub
            </Link>
            <Link
              href="https://www.x402.org/directory"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-sm font-mono text-[#999999] hover:border-[var(--border-default)] hover:text-white transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              x402 Directory
            </Link>
            <Link
              href="https://app.virtuals.io/acp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-sm font-mono text-[#999999] hover:border-[var(--border-default)] hover:text-white transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Virtuals ACP
            </Link>
          </div>
        </div>

        {/* Back to Explore */}
        <div className="mt-8">
          <Link
            href="/monitor"
            className="text-sm font-mono text-[#3b82f6] hover:underline"
          >
            ← Back to Explorer
          </Link>
        </div>
      </main>
    </div>
  )
}

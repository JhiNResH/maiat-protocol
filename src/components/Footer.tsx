import Link from 'next/link'
import { Feather } from 'lucide-react'

export function Footer() {
  const chains = ['Base', 'Ethereum', 'BNB', 'Solana', 'Unichain']

  return (
    <footer className="bg-surface border-t border-border-subtle px-[60px] pt-[60px] pb-8">
      <div className="flex gap-[60px] w-full">
        {/* Brand */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Feather className="w-6 h-6 text-gold" />
            <span className="font-mono text-lg font-bold tracking-[3px] text-txt-primary">MAIAT</span>
          </div>
          <p className="text-sm text-txt-muted leading-[1.6] max-w-[300px]">
            Ancient wisdom meets cutting-edge technology. Weighing truth for 4000 years, now in milliseconds.
          </p>
        </div>

        {/* Products */}
        <div className="flex flex-col gap-4">
          <span className="text-[13px] font-semibold text-txt-primary">Products</span>
          <span className="text-[13px] text-txt-muted">Score API</span>
          <span className="text-[13px] text-txt-muted">v4 Hook</span>
          <span className="text-[13px] text-txt-muted">AgentKit Plugin</span>
          <span className="text-[13px] text-txt-muted">MCP Server</span>
        </div>

        {/* Developers */}
        <div className="flex flex-col gap-4">
          <span className="text-[13px] font-semibold text-txt-primary">Developers</span>
          <Link href="/docs" className="text-[13px] text-txt-muted hover:text-txt-primary transition-colors">Documentation</Link>
          <a href="https://github.com/JhiNResH/maiat" target="_blank" rel="noopener noreferrer" className="text-[13px] text-txt-muted hover:text-txt-primary transition-colors">GitHub</a>
          <span className="text-[13px] text-txt-muted">SDK</span>
          <span className="text-[13px] text-txt-muted">Status</span>
        </div>

        {/* Community */}
        <div className="flex flex-col gap-4">
          <span className="text-[13px] font-semibold text-txt-primary">Community</span>
          <a href="https://x.com/0xmaiat" target="_blank" rel="noopener noreferrer" className="text-[13px] text-txt-muted hover:text-txt-primary transition-colors">Twitter</a>
          <span className="text-[13px] text-txt-muted">Discord</span>
          <span className="text-[13px] text-txt-muted">Blog</span>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-border-subtle my-12" />

      {/* Bottom */}
      <div className="flex items-center justify-between w-full">
        <span className="text-xs text-txt-muted">&copy; 2026 Maiat Protocol. All rights reserved.</span>
        <div className="flex items-center gap-3">
          {chains.map((chain) => (
            <span
              key={chain}
              className="text-[11px] font-medium text-txt-muted px-3 py-1 rounded-full border border-border-subtle bg-[#1e203520]"
            >
              {chain}
            </span>
          ))}
        </div>
      </div>
    </footer>
  )
}

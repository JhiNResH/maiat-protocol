'use client';

import React from 'react';
import { ShieldCheck, Twitter, Github } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-20 pt-20 pb-10 border-t border-[var(--border-color)] relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-[var(--text-color)] rounded-full flex items-center justify-center text-[var(--bg-color)]">
                <ShieldCheck size={24} />
              </div>
              <span className="font-display font-bold text-2xl tracking-tight text-[var(--text-color)]">maiat</span>
            </div>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-8">
              Trust infrastructure for AI agents. Verify, score, and gate autonomous transactions.
            </p>
            <div className="flex items-center gap-5">
              <Link href="https://x.com/MaiatProtocol" target="_blank" className="w-10 h-10 rounded-full liquid-glass border-white/40 dark:border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-all hover-lift">
                <Twitter size={20} />
              </Link>
              <Link href="https://github.com/JhiNResH/maiat-protocol" target="_blank" className="w-10 h-10 rounded-full liquid-glass border-white/40 dark:border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-all hover-lift">
                <Github size={20} />
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--text-color)] mb-8">Product</h4>
            <ul className="space-y-4">
              <li><Link href="https://github.com/JhiNResH/maiat-guard" target="_blank" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Maiat Guard</Link></li>
              <li><Link href="https://github.com/JhiNResH/maiat-protocol" target="_blank" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Maiat ACP</Link></li>

              <li><Link href="https://app.ens.domains/maiat.eth" target="_blank" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">maiat.eth</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--text-color)] mb-8">Developers</h4>
            <ul className="space-y-4">
              <li><Link href="/docs" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Documentation</Link></li>
              <li><Link href="https://github.com/JhiNResH/maiat-protocol" target="_blank" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">GitHub</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--text-color)] mb-8">Get Started</h4>
            <p className="text-[var(--text-secondary)] text-xs mb-6">Register your agent and start building trust on-chain.</p>
            <div className="flex flex-col gap-3">
              <Link
                href="https://passport.maiat.io"
                target="_blank"
                className="bg-[var(--text-color)] text-[var(--bg-color)] px-4 py-3 rounded-xl text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg shadow-black/5 active:scale-95 text-center"
              >
                Register Agent
              </Link>
              <Link
                href="/docs"
                className="liquid-glass border-white/40 dark:border-white/10 px-4 py-3 rounded-xl text-xs font-bold text-center text-[var(--text-color)] hover:bg-[var(--text-color)]/5 transition-all"
              >
                View Docs
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-10 border-t border-[var(--border-color)] gap-6">
          <p className="text-[var(--text-secondary)] text-[10px] font-medium">© 2026 Maiat Protocol. All rights reserved.</p>
          <div className="flex items-center gap-8">
            <Link href="https://github.com/JhiNResH/maiat-protocol/blob/master/LICENSE" target="_blank" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-[10px] font-bold transition-colors">MIT License</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

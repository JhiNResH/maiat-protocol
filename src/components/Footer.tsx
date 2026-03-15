'use client';

import React from 'react';
import { ShieldCheck, Twitter, Github, Disc as Discord, ExternalLink } from 'lucide-react';
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
              <span className="font-display font-bold text-2xl tracking-tight text-[var(--text-color)]">Maiat</span>
            </div>
            <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-8">
              The decentralized truth layer. Verifying the future of autonomous agent communication and trust.
            </p>
            <div className="flex items-center gap-5">
              <Link href="#" className="w-10 h-10 rounded-full liquid-glass border-white/40 dark:border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-all hover-lift">
                <Twitter size={20} />
              </Link>
              <Link href="#" className="w-10 h-10 rounded-full liquid-glass border-white/40 dark:border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-all hover-lift">
                <Discord size={20} />
              </Link>
              <Link href="#" className="w-10 h-10 rounded-full liquid-glass border-white/40 dark:border-white/10 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-all hover-lift">
                <Github size={20} />
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--text-color)] mb-8">Product</h4>
            <ul className="space-y-4">
              <li><Link href="/" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Verify</Link></li>
              <li><Link href="/markets" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Markets</Link></li>
              <li><Link href="/analytics" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Analytics</Link></li>
              <li><Link href="/leaderboard" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Leaderboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--text-color)] mb-8">Resources</h4>
            <ul className="space-y-4">
              <li><Link href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Documentation</Link></li>
              <li><Link href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">API Reference</Link></li>
              <li><Link href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Brand Assets</Link></li>
              <li><Link href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-xs font-bold transition-colors">Support</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--text-color)] mb-8">Newsletter</h4>
            <p className="text-[var(--text-secondary)] text-xs mb-6">Stay updated with the latest protocol updates and security alerts.</p>
            <div className="flex flex-col gap-3">
              <input 
                type="email" 
                placeholder="Email address" 
                className="liquid-glass border-white/40 dark:border-white/10 rounded-xl px-4 py-3 text-xs w-full focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 transition-all text-[var(--text-color)] placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
              <button className="bg-[var(--text-color)] text-[var(--bg-color)] px-4 py-3 rounded-xl text-xs font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-lg shadow-black/5 active:scale-95">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-10 border-t border-[var(--border-color)] gap-6">
          <p className="text-[var(--text-secondary)] text-[10px] font-medium">© 2026 Maiat Protocol. All rights reserved.</p>
          <div className="flex items-center gap-8">
            <Link href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-[10px] font-bold transition-colors">Privacy Policy</Link>
            <Link href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-[10px] font-bold transition-colors">Terms of Service</Link>
            <Link href="#" className="text-[var(--text-secondary)] hover:text-[var(--text-color)] text-[10px] font-bold transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

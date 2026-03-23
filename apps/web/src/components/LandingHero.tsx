'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Bot, Shield, Zap, ArrowRight, Copy, Check, Terminal } from 'lucide-react';
import Link from 'next/link';

const SKILL_URL = 'https://app.maiat.io/skill.md';

/* ── Ma'at Feather SVG ── */
function MaatFeather({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Central spine */}
      <motion.line
        x1="32" y1="8" x2="32" y2="112"
        stroke="url(#featherGold)" strokeWidth="1.5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: "easeOut" }}
      />
      {/* Left barbs */}
      {[20, 30, 40, 50, 60, 70, 80, 90].map((y, i) => (
        <motion.line
          key={`l${i}`}
          x1="32" y1={y} x2={8 + i * 1.5} y2={y - 8}
          stroke="url(#featherGold)" strokeWidth="0.8" strokeLinecap="round" opacity={0.6 - i * 0.04}
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.6 - i * 0.04 }}
          transition={{ duration: 1.2, delay: 0.8 + i * 0.1, ease: "easeOut" }}
        />
      ))}
      {/* Right barbs */}
      {[20, 30, 40, 50, 60, 70, 80, 90].map((y, i) => (
        <motion.line
          key={`r${i}`}
          x1="32" y1={y} x2={56 - i * 1.5} y2={y - 8}
          stroke="url(#featherGold)" strokeWidth="0.8" strokeLinecap="round" opacity={0.6 - i * 0.04}
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.6 - i * 0.04 }}
          transition={{ duration: 1.2, delay: 0.8 + i * 0.1, ease: "easeOut" }}
        />
      ))}
      {/* Tip */}
      <motion.ellipse
        cx="32" cy="10" rx="3" ry="6"
        fill="url(#featherGold)" opacity={0.4}
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />
      <defs>
        <linearGradient id="featherGold" x1="32" y1="0" x2="32" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e8b84a" />
          <stop offset="50%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#b8860b" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Trust Score Gauge ── */
function TrustGauge() {
  return (
    <div className="relative w-20 h-20">
      <svg viewBox="0 0 80 80" className="w-full h-full">
        {/* Track */}
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(212,160,23,0.08)" strokeWidth="3" />
        {/* Score arc */}
        <motion.circle
          cx="40" cy="40" r="34" fill="none"
          stroke="url(#gaugeGold)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 34}`}
          strokeDashoffset={2 * Math.PI * 34}
          initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
          animate={{ strokeDashoffset: 2 * Math.PI * 34 * 0.15 }}
          transition={{ duration: 2, delay: 0.5, ease: "easeOut" }}
          transform="rotate(-90 40 40)"
        />
        <defs>
          <linearGradient id="gaugeGold" x1="0" y1="0" x2="80" y2="80">
            <stop offset="0%" stopColor="#e8b84a" />
            <stop offset="100%" stopColor="#d4a017" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-lg font-black text-[var(--primary-gold)]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
        >
          85
        </motion.span>
        <span className="text-[8px] text-slate-500 font-mono">/100</span>
      </div>
    </div>
  );
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="group relative bg-black/40 border border-[rgba(212,160,23,0.1)] rounded-xl px-4 py-3 font-mono text-sm text-[var(--primary-gold-light)] cursor-pointer hover:border-[rgba(212,160,23,0.3)] transition-all"
    >
      <code className="break-all">{text}</code>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-[var(--primary-gold)] transition-colors">
        {copied ? <Check size={14} className="text-[var(--primary-gold)]" /> : <Copy size={14} />}
      </div>
    </div>
  );
}

export function LandingHero() {
  const [mode, setMode] = useState<'human' | 'agent'>('human');

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col relative overflow-hidden">
      {/* Subtle radial glow behind hero */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(212,160,23,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 relative z-10">
        {/* Feather + Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, ease: "easeOut" }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-4 mb-6">
            <MaatFeather className="w-6 h-16 opacity-60" />
            <div>
              <div className="inline-flex items-center gap-3 mb-1">
                <Shield className="w-7 h-7 text-[var(--primary-gold)]" />
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  Maiat Protocol
                </h1>
              </div>
              <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
                Trust infrastructure for the agent economy.
                <br />
                <span className="text-slate-500">Verify before you transact.</span>
              </p>
            </div>
            <TrustGauge />
          </div>
        </motion.div>

        {/* ── Toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
          className="flex items-center gap-2 p-1 bg-white/[0.04] border border-white/10 rounded-xl mb-8"
        >
          <button
            onClick={() => setMode('human')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-500 ${
              mode === 'human'
                ? 'bg-white/10 text-white shadow-lg shadow-white/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <User size={16} />
            I&apos;m a Human
          </button>
          <button
            onClick={() => setMode('agent')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-500 ${
              mode === 'agent'
                ? 'bg-[rgba(212,160,23,0.15)] text-[var(--primary-gold-light)] shadow-lg shadow-[rgba(212,160,23,0.1)] border border-[rgba(212,160,23,0.3)]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Bot size={16} />
            I&apos;m an Agent
          </button>
        </motion.div>

        {/* ── Content Cards ── */}
        <AnimatePresence mode="wait">
          {mode === 'human' ? (
            <motion.div
              key="human"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full max-w-lg"
            >
              <div className="glass-card rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-black text-white text-center">
                  Verify Trust Before You Transact.
                </h2>
                <div className="bg-white/[0.04] rounded-xl p-4 text-sm text-slate-400 text-center leading-relaxed">
                  Check any AI agent&apos;s behavioral trust score — powered by real Virtuals ACP job history on Base.
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex gap-3 items-start">
                    <span className="text-[var(--primary-gold)] font-bold">1.</span>
                    <span>Enter any EVM wallet address</span>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-[var(--primary-gold)] font-bold">2.</span>
                    <span>Get a trust score (0–100) and verdict</span>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-[var(--primary-gold)] font-bold">3.</span>
                    <span>Decide whether to proceed, caution, or avoid</span>
                  </div>
                </div>
                <Link
                  href="/monitor"
                  className="flex items-center justify-center gap-2 w-full py-3.5 px-4 bg-gradient-to-r from-[var(--primary-gold-dim)] to-[var(--primary-gold)] hover:from-[var(--primary-gold)] hover:to-[var(--primary-gold-light)] rounded-xl text-sm font-bold text-white transition-all duration-500 group shadow-lg shadow-[rgba(212,160,23,0.15)]"
                >
                  Launch App
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="agent"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="w-full max-w-lg"
            >
              <div className="glass-card rounded-2xl p-6 space-y-5 border-[rgba(212,160,23,0.15)] shadow-lg shadow-[rgba(212,160,23,0.05)]">
                <div className="flex items-center justify-center gap-2">
                  <Bot size={16} className="text-[var(--primary-gold)]" />
                  <h2 className="text-base font-black text-white">
                    Integrate Maiat Trust ⚖️
                  </h2>
                </div>

                <div className="bg-black/30 border border-[rgba(212,160,23,0.08)] rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold text-[var(--primary-gold-dim)] uppercase tracking-[0.2em] block text-center">ADD TO YOUR AGENT</span>
                  <div className="font-mono text-sm text-[var(--primary-gold)] text-center leading-relaxed break-all">
                    Read {SKILL_URL} and follow the instructions
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex gap-3 items-start">
                    <span className="text-[var(--primary-gold)] font-bold">1</span>
                    <span>Read the skill file above — it teaches your agent the Maiat API</span>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-[var(--primary-gold)] font-bold">2</span>
                    <span>Query trust scores before any transaction or interaction</span>
                  </div>
                  <div className="flex gap-3 items-start">
                    <span className="text-[var(--primary-gold)] font-bold">3</span>
                    <span>Use the verdict to gate your agent&apos;s on-chain actions</span>
                  </div>
                </div>

                <div className="bg-black/30 border border-[rgba(212,160,23,0.08)] rounded-xl p-4 space-y-2 text-center">
                  <span className="text-[10px] font-bold text-[var(--primary-gold-dim)] uppercase tracking-[0.2em]">QUICK API EXAMPLE</span>
                  <pre className="text-[12px] font-mono text-[var(--primary-gold)] leading-relaxed overflow-x-auto">
{`GET /api/v1/agent/0x742d35Cc...
→ { trustScore: 85, verdict: "proceed" }`}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <Link
                    href="/docs"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[var(--primary-gold-dim)] to-[var(--primary-gold)] hover:from-[var(--primary-gold)] hover:to-[var(--primary-gold-light)] rounded-xl text-sm font-bold text-white transition-all duration-500 group shadow-lg shadow-[rgba(212,160,23,0.15)]"
                  >
                    Read Full Docs
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/monitor"
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-slate-300 transition-all duration-500"
                  >
                    Explore Agents
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Footer ── */}
      <div className="text-center py-6 text-[10px] text-slate-600 relative z-10">
        Built on Base · Powered by Virtuals ACP
      </div>
    </div>
  );
}

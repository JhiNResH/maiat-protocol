'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Bot, Shield, Zap, ArrowRight, Copy, Check, Terminal } from 'lucide-react';
import Link from 'next/link';

const SKILL_URL = 'https://app.maiat.io/skill.md';

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="group relative bg-black/60 border border-white/10 rounded-xl px-4 py-3 font-mono text-sm text-emerald-400 cursor-pointer hover:border-emerald-500/40 transition-all"
    >
      <code className="break-all">{text}</code>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-emerald-400 transition-colors">
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </div>
    </div>
  );
}

export function LandingHero() {
  const [mode, setMode] = useState<'human' | 'agent'>('human');

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col">
      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        {/* Logo + Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Maiat Protocol
            </h1>
          </div>
          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto leading-relaxed">
            Trust infrastructure for the agent economy.
            <br />
            <span className="text-slate-500">Verify before you transact.</span>
          </p>
        </motion.div>

        {/* ── Toggle ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex items-center gap-2 p-1 bg-white/[0.04] border border-white/10 rounded-xl mb-8"
        >
          <button
            onClick={() => setMode('human')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 ${
              mode === 'agent'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/10 border border-emerald-500/30'
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
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg"
            >
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Shield size={16} className="text-blue-400" />
                  Check Any Agent&apos;s Trust Score
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Paste any wallet address to get a behavioral trust score (0–100) based on real ACP job history. 
                  See completion rate, payment reliability, and a proceed / caution / avoid verdict.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { icon: Zap, label: 'Real-time Scores', desc: '17,000+ agents indexed' },
                    { icon: Shield, label: 'On-chain Verified', desc: 'Built on Base' },
                    { icon: Terminal, label: 'Free API', desc: 'No key required' },
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <item.icon size={14} className="text-blue-400" />
                      <span className="text-[11px] font-bold text-white">{item.label}</span>
                      <span className="text-[10px] text-slate-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/monitor"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-bold text-white transition-all group"
                >
                  Open Trust Monitor
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
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg"
            >
              <div className="bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-6 space-y-5 shadow-lg shadow-emerald-500/5">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Bot size={16} className="text-emerald-400" />
                  Integrate Maiat Trust ⚖️
                </h2>

                <CopyBlock text={`Read ${SKILL_URL} and follow the instructions`} />

                <div className="space-y-3 text-sm">
                  {[
                    { n: 1, text: 'Read the skill file above to get started' },
                    { n: 2, text: 'Query the API before any transaction' },
                    { n: 3, text: 'Use the verdict to gate your agent\'s actions' },
                  ].map((step) => (
                    <div key={step.n} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[11px] font-black text-emerald-400">
                        {step.n}
                      </span>
                      <span className="text-slate-300 pt-0.5">{step.text}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Quick API Example</span>
                  <pre className="text-[11px] font-mono text-emerald-400/80 leading-relaxed overflow-x-auto">
{`GET /api/v1/agent/0x...
→ { trustScore: 85, verdict: "proceed" }`}
                  </pre>
                </div>

                <div className="flex gap-2">
                  <Link
                    href="/docs"
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-sm font-bold text-emerald-400 transition-all group"
                  >
                    Read Docs
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/monitor"
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-slate-300 transition-all"
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
      <div className="text-center py-6 text-[10px] text-slate-600">
        Built on Base · Powered by Virtuals ACP
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  ShieldCheck, 
  ArrowRight, 
  User, 
  Wallet, 
  Activity, 
  CheckCircle2, 
  Zap,
  Lock,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import StatCard from '@/components/StatCard';
import { cn } from '@/lib/utils';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── TrustScoreGauge ─────────────────────────────────────────────────────────

const TrustScoreGauge = ({ score }: { score: number }) => {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="w-48 h-48 transform -rotate-90">
        <circle cx="96" cy="96" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-[var(--border-color)]" />
        <motion.circle
          cx="96" cy="96" r={radius}
          stroke="currentColor" strokeWidth="8" fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="text-emerald-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-7xl font-black text-[var(--text-color)] tracking-tighter"
        >
          {score}
        </motion.span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
          Verified
        </span>
      </div>
    </div>
  );
};

// ─── VerifyResult ──────────────────────────────────────────────────────────────

interface AgentResult {
  name?: string;
  address?: string;
  trust?: { score: number | null; grade: string | null };
  breakdown?: { completionRate?: number | null; paymentRate?: number | null; totalJobs?: number | null };
  error?: string;
}

const VerifyResultPanel = ({ address }: { address: string }) => {
  const { data, error, isLoading } = useSWR<AgentResult>(
    address ? `/api/v1/agent/${address}` : null,
    fetcher
  );

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 liquid-glass rounded-[2rem] p-8 flex items-center justify-center gap-3"
      >
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-[var(--text-secondary)] font-mono text-sm">Verifying...</span>
      </motion.div>
    );
  }

  if (error || data?.error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 liquid-glass rounded-[2rem] p-8 flex items-center gap-4"
      >
        <AlertCircle size={24} className="text-rose-500 shrink-0" />
        <div>
          <p className="font-bold text-[var(--text-color)]">No data found</p>
          <p className="text-sm text-[var(--text-secondary)] font-mono">{address}</p>
        </div>
      </motion.div>
    );
  }

  if (!data) return null;

  const score = data.trust?.score ?? 0;
  const verdict = score >= 80 ? 'TRUSTED' : score >= 60 ? 'CAUTION' : 'SUSPICIOUS';
  const verdictColor = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'rose';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 liquid-glass rounded-[2rem] p-8"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center">
            <User size={28} className="text-[var(--text-muted)]" />
          </div>
          <div>
            <p className="font-bold text-lg text-[var(--text-color)]">{data.name ?? 'Unknown Agent'}</p>
            <p className="font-mono text-xs text-[var(--text-muted)] break-all">{address}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-4xl font-black text-[var(--text-color)]">{score.toFixed(1)}</p>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Trust Score</p>
          </div>
          <span className={cn(
            "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border",
            verdictColor === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' :
            verdictColor === 'amber' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' :
            'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
          )}>
            {verdict}
          </span>
        </div>
      </div>

      {data.breakdown && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          {data.breakdown.completionRate != null && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Completion</p>
              <p className="text-xl font-black text-[var(--text-color)]">{(data.breakdown.completionRate * 100).toFixed(0)}%</p>
            </div>
          )}
          {data.breakdown.paymentRate != null && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Payment</p>
              <p className="text-xl font-black text-[var(--text-color)]">{(data.breakdown.paymentRate * 100).toFixed(0)}%</p>
            </div>
          )}
          {data.breakdown.totalJobs != null && (
            <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">Total Jobs</p>
              <p className="text-xl font-black text-[var(--text-color)]">{data.breakdown.totalJobs.toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

const recentVerifications = [
  { id: '1', address: '0x71c...0E2f', status: 'TRUSTED', score: 92 },
  { id: '2', address: '0xaf2...3c41', status: 'SUSPICIOUS', score: 42 },
  { id: '3', address: 'vitalik.eth', status: 'TRUSTED', score: 98 },
  { id: '4', address: '0x12b...99a2', status: 'TRUSTED', score: 88 },
  { id: '5', address: '0xbc4...7621', status: 'TRUSTED', score: 95 },
];

export default function VerifyPage() {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [submittedAddress, setSubmittedAddress] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Fetch real stats
  const { data: statsData } = useSWR('/api/v1/stats/engagement', fetcher);

  const handleVerify = () => {
    const val = searchValue.trim();
    if (!val) return;
    setSubmittedAddress(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleVerify();
  };

  return (
    <div className="min-h-screen pb-20 relative">

      <main className="max-w-7xl mx-auto px-6 relative">
        {/* Vertical Rail Text */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 hidden xl:block">
          <p className="rail-text">DECENTRALIZED TRUTH LAYER • MAIAT PROTOCOL v2.0</p>
        </div>

        {/* Hero Section */}
        <section className="text-center mb-24 relative pt-16 min-h-[50vh] flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--text-color)] text-[var(--bg-color)] text-[10px] font-black uppercase tracking-[0.2em] mb-12 mx-auto"
          >
            <Zap size={14} className="text-emerald-400 fill-emerald-400" />
            <span>Mainnet Live</span>
          </motion.div>

          <div className="relative mb-16">
            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="atmosphere-text font-black"
            >
              Verify any <br />
              address.
            </motion.h1>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[var(--text-secondary)] text-xl md:text-2xl max-w-2xl mx-auto font-medium mb-20 leading-tight"
          >
            The decentralized truth layer. Verifying the future of{' '}
            <span className="text-[var(--text-color)] font-bold underline decoration-emerald-500/30 underline-offset-8">
              autonomous agents
            </span>{' '}
            and trust.
          </motion.p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-3xl mx-auto w-full relative group z-20"
          >
            <div className={cn(
              "liquid-glass flex items-center px-10 py-6 transition-all duration-700 rounded-[3rem]",
              isFocused ? "ring-[15px] ring-[var(--text-color)]/5 scale-[1.02] shadow-[0_40px_100px_rgba(0,0,0,0.1)]" : "hover:scale-[1.01]"
            )}>
              <div className="flex items-center pointer-events-none mr-6">
                <Search
                  className={cn("transition-colors duration-500", isFocused ? "text-[var(--text-color)]" : "text-[var(--text-muted)]")}
                  size={28}
                />
              </div>
              <input
                type="text"
                placeholder="0x... or agent name"
                className="bg-transparent border-none focus:outline-none w-full text-xl md:text-2xl font-bold text-[var(--text-color)] placeholder:text-[var(--text-muted)] outline-none"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={handleVerify}
                className="bg-[var(--text-color)] text-[var(--bg-color)] px-8 md:px-12 py-4 rounded-full font-bold hover:opacity-90 transition-all shadow-2xl shadow-black/20 dark:shadow-white/5 flex items-center gap-3 group/btn shrink-0"
              >
                Verify <ArrowRight size={20} className="group-hover/btn:translate-x-2 transition-transform" />
              </button>
            </div>
          </motion.div>

          {/* Result panel */}
          {submittedAddress && <VerifyResultPanel address={submittedAddress} />}

          {/* Marquee */}
          <div className="mt-24 marquee-container">
            <div className="marquee-content">
              {[...Array(4)].map((_, i) => (
                <span key={i} className="inline-flex items-center gap-12 px-6">
                  {recentVerifications.map((item) => (
                    <span key={item.id} className="flex items-center gap-3">
                      <div className={cn("w-2 h-2 rounded-full", item.status === 'TRUSTED' ? 'bg-emerald-500' : 'bg-rose-500')} />
                      <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)] uppercase tracking-widest whitespace-nowrap">{item.address}</span>
                      <span className="text-[10px] font-bold text-[var(--text-muted)] whitespace-nowrap">SCORE: {item.score}</span>
                    </span>
                  ))}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          <StatCard
            label="Total Queries"
            value={statsData?.overview?.total?.toLocaleString() ?? '—'}
            change={statsData?.overview?.last24h ? `+${statsData.overview.last24h} today` : undefined}
            changeType="increase"
            delay={0.4}
          />
          <StatCard
            label="Unique Agents"
            value={statsData?.overview?.uniqueTargets?.toLocaleString() ?? '—'}
            change="Global network"
            changeType="neutral"
            delay={0.5}
          />
          <StatCard
            label="Active Callers"
            value={statsData?.overview?.uniqueCallers7d?.toLocaleString() ?? '—'}
            change="Last 7 days"
            changeType="increase"
            delay={0.6}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left: Recent Verifications */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8 liquid-glass p-10 rounded-[3rem] hover-lift"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-3xl font-bold text-[var(--text-color)] mb-2">Live Feed</h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium">Recent protocol verifications</p>
              </div>
              <button
                onClick={() => router.push('/leaderboard')}
                className="group text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors flex items-center gap-2"
              >
                View Leaderboard <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="space-y-3">
              {recentVerifications.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center justify-between p-5 rounded-[2rem] hover:bg-[var(--text-color)] hover:text-[var(--bg-color)] transition-all duration-500 group cursor-pointer border border-transparent hover:border-[var(--border-color)]"
                  onClick={() => {
                    setSearchValue(item.address);
                    setSubmittedAddress(item.address);
                  }}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-[var(--card-bg)] rounded-2xl flex items-center justify-center text-[var(--text-muted)] group-hover:bg-[var(--bg-color)]/10 group-hover:text-[var(--bg-color)] transition-all">
                      <User size={24} />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-base">{item.address}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] group-hover:text-[var(--bg-color)]/60">
                        {item.status}
                      </p>
                    </div>
                  </div>
                  <div className={cn(
                    "px-5 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase border transition-colors",
                    item.status === 'TRUSTED'
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 border-emerald-100 dark:border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-transparent'
                      : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-100 dark:border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white group-hover:border-transparent'
                  )}>
                    Score: {item.score}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Trust Index */}
          <div className="lg:col-span-4 space-y-10">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="liquid-glass p-10 text-center relative overflow-hidden rounded-[3.5rem] hover-lift"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-10">Global Trust Index</p>

              <div className="mb-10">
                <TrustScoreGauge score={92} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="bg-[var(--card-bg)] p-5 rounded-[2rem] border border-[var(--border-color)]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Anti-Poison</p>
                  <p className="text-xs font-bold text-emerald-500 dark:text-emerald-400 flex items-center gap-2">Clean <CheckCircle2 size={12} /></p>
                </div>
                <div className="bg-[var(--card-bg)] p-5 rounded-[2rem] border border-[var(--border-color)]">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Network</p>
                  <p className="text-xs font-bold text-[var(--text-color)]">Base + ETH</p>
                </div>
              </div>
            </motion.div>

            {/* Activity */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="liquid-glass p-10 rounded-[3rem] hover-lift"
            >
              <div className="flex items-center gap-3 mb-8">
                <Activity size={18} className="text-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--text-color)]">Network Activity</h2>
              </div>
              <div className="space-y-8">
                {[
                  { method: 'Agent Verify', target: '0x71c...8E2F', time: '12s ago', color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-500' },
                  { method: 'Trust Score', target: '0x3F2...2a11', time: '4m ago', color: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500' },
                  { method: 'EAS Attest', target: '0x111...bcde', time: '16m ago', color: 'bg-purple-50 dark:bg-purple-500/10 text-purple-500' },
                ].map((act, i) => (
                  <div key={i} className="flex items-start justify-between group cursor-pointer">
                    <div className="flex gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110", act.color)}>
                        <Activity size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-color)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{act.method}</p>
                        <p className="text-[10px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-widest">{act.target}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-widest">{act.time}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Features */}
        <section className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: ShieldCheck, title: "Sybil Protection", desc: "Advanced heuristics to identify and flag coordinated sybil attacks." },
            { icon: Lock, title: "Privacy First", desc: "Zero-knowledge proofs for identity verification without exposing PII." },
            { icon: Zap, title: "Instant Scores", desc: "Sub-second latency for real-time trust assessment across all chains." }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-10 rounded-[2.5rem] bg-[var(--card-bg)] border border-[var(--border-color)] hover:border-emerald-500/30 transition-all group hover-lift"
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-color)] group-hover:bg-emerald-50 dark:group-hover:bg-emerald-500/10 flex items-center justify-center mb-8 transition-colors">
                <feature.icon size={28} className="text-[var(--text-color)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-color)] mb-4">{feature.title}</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </section>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-32 liquid-glass p-16 rounded-[4rem] relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50 dark:bg-emerald-500/10 blur-[100px] -mr-48 -mt-48 opacity-50" />
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="text-center lg:text-left">
              <h2 className="text-5xl font-bold text-[var(--text-color)] mb-6">Build with Maiat</h2>
              <p className="text-[var(--text-secondary)] text-xl max-w-md font-medium">Integrate our trust engine into your own dApp or AI Agent with our high-performance API.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-5">
              <a
                href="/docs"
                className="bg-[var(--card-bg)] hover:opacity-80 border border-[var(--border-color)] text-[var(--text-color)] px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-3"
              >
                View Docs
              </a>
              <button className="bg-[var(--text-color)] hover:opacity-90 text-[var(--bg-color)] px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95">
                Get API Key
              </button>
            </div>
          </div>

          <div className="mt-12 bg-[var(--card-bg)] rounded-[2rem] p-8 font-mono text-sm text-[var(--text-color)] border border-[var(--border-color)]">
            <div className="flex gap-3 mb-6">
              <div className="w-3 h-3 rounded-full bg-[var(--text-muted)]" />
              <div className="w-3 h-3 rounded-full bg-[var(--text-muted)]" />
              <div className="w-3 h-3 rounded-full bg-[var(--text-muted)]" />
            </div>
            <p className="flex items-center gap-4 text-base font-bold flex-wrap">
              <span className="text-[var(--text-muted)]">$</span>
              <span>curl https://maiat.io/api/v1/agent/0x71c...4E8F</span>
            </p>
          </div>
        </motion.div>
      </main>

    </div>
  );
}

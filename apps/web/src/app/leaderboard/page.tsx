"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Shield, Trophy, TrendingUp } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface ERC8004Data {
  registered: boolean;
  agentId?: number;
  reputation?: {
    count: number;
    value: number;
    normalizedScore: number;
  };
}

interface Agent {
  id: string;
  name: string;
  category?: string | null;
  chain: string;
  logo?: string | null;
  trust: {
    score: number | null;
    grade: string | null;
  };
  breakdown?: {
    completionRate?: number | null;
    paymentRate?: number | null;
    totalJobs?: number | null;
    agdp?: number | null;
  };
  erc8004?: ERC8004Data | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function truncateAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function cleanAgentName(name: string) {
  return (name || "agent").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
}

function formatAgdp(val: number | null | undefined): string {
  if (val == null) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function scoreToVerdict(score: number | null): "proceed" | "caution" | "avoid" | "unknown" {
  if (score === null || score === undefined) return "unknown";
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

function verdictStyle(verdict: string) {
  switch (verdict) {
    case "proceed": return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20";
    case "caution": return "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20";
    case "avoid": return "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20";
    default: return "bg-[var(--bg-color)] text-[var(--text-muted)] border-[var(--border-color)]";
  }
}

function trustScoreColor(score: number | null) {
  if (score === null) return "text-[var(--text-muted)]";
  if (score >= 80) return "text-emerald-500 dark:text-emerald-400";
  if (score >= 60) return "text-amber-500 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}

// ============================================================================
// PAGE WRAPPER
// ============================================================================

export default function LeaderboardPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <Trophy className="w-8 h-8 text-amber-400 animate-pulse" />
          <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Loading Leaderboard...</span>
        </div>
      </div>
    }>
      <LeaderboardPage />
    </Suspense>
  );
}



// ============================================================================
// MAIN PAGE
// ============================================================================

function LeaderboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"trust" | "jobs">("jobs");
  const [query, setQuery] = useState("");
  const [serverResults, setServerResults] = useState<Agent[]>([]);

  // Fetch agents
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const params = new URLSearchParams({ sort: sortBy, limit: "200" });
        const res = await fetch(`/api/v1/agents?${params}`);
        const data = await res.json();
        if (Array.isArray(data.agents)) {
          setAgents(data.agents);
        } else {
          setAgents([]);
        }
      } catch (err) {
        console.error("[Leaderboard] Failed to fetch agents:", err);
        setAgents([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [sortBy]);

  // Server-side search
  useEffect(() => {
    if (!query.trim()) { setServerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/agents?search=${encodeURIComponent(query.trim())}&limit=20&sort=${sortBy}`);
        const data = await res.json();
        setServerResults(data.agents || []);
      } catch { setServerResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sortBy]);

  const sorted = [...agents].sort((a, b) =>
    sortBy === "jobs"
      ? (b.breakdown?.totalJobs ?? 0) - (a.breakdown?.totalJobs ?? 0)
      : (b.trust.score ?? -1) - (a.trust.score ?? -1)
  );

  const displayAgents = query.trim()
    ? (serverResults.length > 0
        ? serverResults
        : sorted.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()) || a.id.toLowerCase().includes(query.toLowerCase())))
    : sorted.slice(0, 50);

  const top3 = sorted.slice(0, 3);
  const restList = displayAgents.slice(query.trim() ? 0 : 3);

  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3;

  const podiumRanks = top3.length >= 3 ? [2, 1, 3] : [1, 2, 3];

  return (
    <div className="pb-20 relative">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 relative">
        {/* Hero */}
        <section className="text-center mb-12 sm:mb-24 pt-6 sm:pt-12">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="atmosphere-text font-black text-[var(--text-color)]"
          >
            Leaderboard.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[var(--text-secondary)] text-xl max-w-2xl mx-auto font-medium mt-8"
          >
            The most trusted AI agents ranked by real-time behavioral verification and trust score.
          </motion.p>
        </section>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Trophy className="w-8 h-8 text-amber-400 animate-pulse" />
            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Loading agents...</span>
          </div>
        )}

        {!loading && agents.length > 0 && !query.trim() && (
          <>
            {/* Top 3 Podiums */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-12 mb-12 sm:mb-24 items-end">
              {podiumOrder.map((agent, i) => {
                const rank = podiumRanks[i];
                const isFeatured = rank === 1;
                return (
                  <motion.div
                    key={agent.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => router.push(`/agent/${cleanAgentName(agent.name)}/${agent.id}`)}
                    className={`relative liquid-glass rounded-[3rem] border-white/40 p-10 hover-lift cursor-pointer ${
                      isFeatured ? "md:scale-110 z-10 ring-8 ring-[var(--text-color)]/5" : "scale-95"
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className={`absolute -top-5 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full flex items-center justify-center text-[var(--bg-color)] text-sm font-bold shadow-lg ${
                      rank === 1 ? "bg-[var(--text-color)]" : rank === 2 ? "bg-[var(--text-secondary)]" : "bg-[var(--text-muted)]"
                    }`}>
                      #{rank}
                    </div>

                    <div className="text-center mb-10">
                      {agent.logo ? (
                        <img src={agent.logo} alt={agent.name} className="w-24 h-24 mx-auto rounded-3xl object-cover mb-6 border border-[var(--border-color)]" />
                      ) : (
                        <div className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-5xl mb-6 bg-[var(--bg-color)] border border-[var(--border-color)]">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <h3 className="font-display font-bold text-2xl mb-2 text-[var(--text-color)] truncate">{agent.name}</h3>
                      <p className="text-[10px] font-mono text-[var(--text-muted)]">{truncateAddress(agent.id)}</p>
                      <div className={`text-4xl sm:text-6xl font-bold mt-4 mb-3 tracking-tighter ${trustScoreColor(agent.trust.score)}`}>
                        {agent.trust.score ?? "?"}
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Trust Score</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-8 border-t border-[var(--border-color)]">
                      <div className="text-center">
                        <p className="text-xl font-bold text-[var(--text-color)]">{agent.breakdown?.totalJobs?.toLocaleString() ?? "—"}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Jobs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[var(--text-color)]">{formatAgdp(agent.breakdown?.agdp)}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">AGDP</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* Search + Sort Controls */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8"
          >
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or address..."
                className="w-full liquid-glass rounded-2xl pl-12 pr-6 py-4 text-sm text-[var(--text-color)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--text-color)]/5 transition-all"
              />
            </div>
            <div className="flex gap-2">
              {(["jobs", "trust"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-4 py-3 sm:px-6 sm:py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                    sortBy === s
                      ? "bg-[var(--text-color)] text-[var(--bg-color)]"
                      : "liquid-glass text-[var(--text-secondary)] hover:text-[var(--text-color)]"
                  }`}
                >
                  By {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* List Table */}
        {!loading && displayAgents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="liquid-glass rounded-[3rem] border-white/40 overflow-hidden hover-lift"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-color)] border-b border-[var(--border-color)]">
                  <th className="px-3 sm:px-10 py-3 sm:py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Rank</th>
                  <th className="px-3 sm:px-10 py-3 sm:py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Agent</th>
                  <th className="px-3 sm:px-10 py-3 sm:py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-center hidden md:table-cell">Jobs</th>
                  <th className="px-3 sm:px-10 py-3 sm:py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-center hidden lg:table-cell">AGDP</th>
                  <th className="px-3 sm:px-10 py-3 sm:py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-center">Verdict</th>
                  <th className="px-3 sm:px-10 py-3 sm:py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-right">Trust Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(query.trim() ? displayAgents : restList).map((agent, i) => {
                  const globalRank = query.trim() ? i + 1 : i + 4;
                  const verdict = scoreToVerdict(agent.trust.score);
                  return (
                    <tr
                      key={agent.id}
                      onClick={() => router.push(`/agent/${cleanAgentName(agent.name)}/${agent.id}`)}
                      className="hover:bg-[var(--bg-color)] transition-all group cursor-pointer"
                    >
                      <td className="px-3 sm:px-10 py-4 sm:py-8 font-bold text-[var(--text-color)] text-sm sm:text-lg">#{globalRank}</td>
                      <td className="px-3 sm:px-10 py-4 sm:py-8">
                        <div className="flex items-center gap-6">
                          {agent.logo ? (
                            <img src={agent.logo} alt={agent.name} className="w-14 h-14 rounded-2xl object-cover" />
                          ) : (
                            <div className="w-14 h-14 bg-[var(--bg-color)] rounded-2xl flex items-center justify-center text-xl font-bold text-[var(--text-color)] group-hover:bg-[var(--text-color)] group-hover:text-[var(--bg-color)] transition-all">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-[var(--text-color)] text-lg block">{agent.name}</span>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">{truncateAddress(agent.id)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-10 py-4 sm:py-8 text-center hidden md:table-cell">
                        <span className="text-base font-bold text-[var(--text-color)]">{agent.breakdown?.totalJobs?.toLocaleString() ?? "—"}</span>
                      </td>
                      <td className="px-3 sm:px-10 py-4 sm:py-8 text-center hidden lg:table-cell">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{formatAgdp(agent.breakdown?.agdp)}</span>
                      </td>
                      <td className="px-3 sm:px-10 py-4 sm:py-8 text-center">
                        <span className={`px-3 py-1.5 rounded-full text-[9px] font-bold tracking-widest border ${verdictStyle(verdict)}`}>
                          {verdict.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 sm:px-10 py-4 sm:py-8 text-right">
                        <span className={`text-2xl font-bold ${trustScoreColor(agent.trust.score)}`}>
                          {agent.trust.score ?? "?"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}

        {!loading && displayAgents.length === 0 && (
          <div className="liquid-glass rounded-[3rem] p-16 flex flex-col items-center justify-center text-center">
            <Trophy className="w-12 h-12 text-[var(--text-muted)] mb-6" />
            <h3 className="text-2xl font-bold text-[var(--text-color)] mb-3">
              {query.trim() ? "No agents found" : "No agents indexed yet"}
            </h3>
            <p className="text-[var(--text-secondary)] font-medium">
              {query.trim() ? "Try a different search term." : "Agents will appear here once indexed by the network."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

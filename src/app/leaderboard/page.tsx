"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Shield, Bot, ArrowUpDown, TrendingUp, Zap, Trophy } from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface Agent {
  id: string;       // wallet address
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
}

// ============================================================================
// HELPERS
// ============================================================================

function truncateAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function cleanAgentName(name: string) {
  return (name || 'agent').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}

function formatAgdp(val: number | null | undefined): string {
  if (val == null) return "—";
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

/** Derive verdict from trust score (0–100 scale). */
function scoreToVerdict(score: number | null): "proceed" | "caution" | "avoid" | "unknown" {
  if (score === null || score === undefined) return "unknown";
  if (score >= 80) return "proceed";
  if (score >= 60) return "caution";
  return "avoid";
}

function verdictStyle(verdict: string) {
  switch (verdict) {
    case "proceed":
      return "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30";
    case "caution":
      return "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30";
    case "avoid":
      return "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30";
    default:
      return "bg-[#666666]/10 text-[#666666] border-[#666666]/30";
  }
}

function verdictLabel(verdict: string) {
  switch (verdict) {
    case "proceed": return "PROCEED";
    case "caution": return "CAUTION";
    case "avoid":   return "AVOID";
    default:        return "UNKNOWN";
  }
}

function trustScoreColor(score: number | null) {
  if (score === null) return "text-[#666666]";
  if (score >= 80) return "text-[#10b981]";
  if (score >= 60) return "text-[#f59e0b]";
  return "text-[#ef4444]";
}

function chainDot(chain: string) {
  switch (chain?.toLowerCase()) {
    case "base":
      return "bg-[#3b82f6]";
    case "ethereum":
    case "eth":
      return "bg-purple-500";
    default:
      return "bg-[#555555]";
  }
}

// ============================================================================
// WRAPPER (required for useSearchParams)
// ============================================================================

export default function LeaderboardPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Trophy className="w-8 h-8 text-[#fbbf24] animate-pulse" />
            <span className="text-xs font-mono text-[#666666] uppercase tracking-widest">
              LOADING LEADERBOARD...
            </span>
          </div>
        </div>
      }
    >
      <LeaderboardPage />
    </Suspense>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function LeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Default to true for the new Leaderboard route
  const isLeaderboard = true;

  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState(searchParams.get("q") || "");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy]   = useState<"trust" | "jobs">("jobs");
  const [totalAgents, setTotalAgents] = useState(0);

  // ── Debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch agents (server-side search) ───────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          sort: sortBy,
          limit: "200",
        });
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        const res = await fetch(`/api/v1/agents?${params}`);
        const data = await res.json();
        if (Array.isArray(data.agents)) {
          setAgents(data.agents);
          setTotalAgents(data.pagination?.total ?? data.agents.length);
        }
      } catch (err) {
        console.error("[Explore] Failed to fetch agents:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [debouncedSearch, sortBy]);

  const toggleSort = () => {
    setSortBy((prev) => (prev === "trust" ? "jobs" : "trust"));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (isLeaderboard) {
    return <LeaderboardView agents={agents} loading={loading} router={router} sortBy={sortBy} />;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[#E5E5E5]">
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-[#3b82f6]" />
            <h1 className="text-xs font-mono text-[#666666] uppercase tracking-widest">
              // AI AGENT BROWSER — VIRTUALS ACP ECOSYSTEM
            </h1>
          </div>
          <div className="h-px bg-gradient-to-r from-[#3b82f6]/50 via-[#1F1F1F] to-transparent" />
          <p className="mt-3 text-sm text-[#555555] font-mono max-w-2xl">
            Browse verified AI agents from the Virtuals ACP network. Trust scores
            reflect on-chain behavioral history — completion rate, payment reliability,
            and activity age.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mb-6">
          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666666]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search by name or address..."
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-3 py-2 pl-9 text-xs font-mono text-[#E5E5E5] placeholder-[#444] outline-none focus:border-[#3b82f6]/40 transition-colors"
            />
          </div>

          {/* Sort */}
          <button
            onClick={toggleSort}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-wide bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[#666666] hover:text-[#999] hover:border-[var(--border-default)] transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === "trust" ? "SORT: TRUST ↓" : "SORT: JOBS ↓"}
          </button>

          {/* Agent Count */}
          {!loading && (
            <span className="text-[10px] font-mono text-[#555555] ml-auto">
              {agents.length}{totalAgents > agents.length ? ` / ${totalAgents}` : ""} agents
            </span>
          )}
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_160px_120px_100px] gap-4 px-4 py-2 text-[9px] font-mono uppercase text-[#666666] tracking-wider border-b border-[var(--border-default)] mb-2">
          <span>AGENT</span>
          <span className="text-center">ADDRESS</span>
          <span className="text-center">VERDICT</span>
          <span className="text-right">TRUST SCORE</span>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex flex-col gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && agents.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <div className="w-16 h-16 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center">
              <Bot className="w-7 h-7 text-[#333333]" />
            </div>
            <div>
              <p className="font-mono text-sm text-[#E5E5E5] mb-2">
                {search
                  ? `NO AGENTS MATCHING "${search.toUpperCase()}"`
                  : "NO AGENTS INDEXED YET"}
              </p>
              <p className="text-xs font-mono text-[#555555] max-w-sm leading-relaxed">
                {search
                  ? search.startsWith("0x")
                    ? "// this address has no ACP history yet"
                    : "// try a different name or paste a wallet address"
                  : "// Maiat indexes AI agents from the Virtuals ACP ecosystem and computes behavioral trust scores from on-chain job history. Check back soon."}
              </p>
            </div>
            {!search && (
              <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-lg">
                <Zap className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span className="text-xs font-mono text-[#3b82f6]">
                  Agents are indexed automatically from Virtuals ACP on-chain activity
                </span>
              </div>
            )}
          </div>
        )}

        {/* Agent List */}
        {!loading && agents.length > 0 && (
          <div className="flex flex-col gap-1">
            {agents.map((agent, idx) => {
              const verdict = scoreToVerdict(agent.trust.score);
              return (
                <button
                  key={agent.id}
                  onClick={() => router.push(`/agent/${cleanAgentName(agent.name)}/${agent.id}`)}
                  className="group grid grid-cols-[1fr_160px_120px_100px] gap-4 items-center px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-left transition-all duration-150 hover:border-[#3b82f6]/50 hover:shadow-[0_0_16px_rgba(0,82,255,0.08)] cursor-pointer w-full"
                  style={{ minHeight: "68px" }}
                >
                  {/* Agent Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank */}
                    <span className="text-[9px] font-mono text-[#333333] w-5 shrink-0 text-right">
                      #{idx + 1}
                    </span>
                    {/* Avatar */}
                    {agent.logo ? (
                      <img src={agent.logo} alt={agent.name} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-xs font-bold text-[#3b82f6] flex-shrink-0">
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {/* Name + chain */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#E5E5E5] truncate group-hover:text-[#3b82f6] transition-colors">
                        {agent.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${chainDot(agent.chain)}`} />
                        <span className="text-[9px] font-mono text-[#555555] uppercase">
                          {agent.chain || "base"}
                        </span>
                        {agent.category && (
                          <>
                            <span className="text-[#333333]">·</span>
                            <span className="text-[9px] font-mono text-[#555555]">
                              {agent.category}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex justify-center">
                    <span className="text-[10px] font-mono text-[#555555] bg-[var(--bg-page)] border border-[var(--border-default)] px-2 py-1 rounded">
                      {truncateAddress(agent.id)}
                    </span>
                  </div>

                  {/* Verdict Badge */}
                  <div className="flex justify-center">
                    <span
                      className={`px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wide rounded border ${verdictStyle(verdict)}`}
                    >
                      {verdictLabel(verdict)}
                    </span>
                  </div>

                  {/* Trust Score */}
                  <div className="flex flex-col items-end">
                    <span
                      className={`text-xl font-black font-mono leading-none ${trustScoreColor(agent.trust.score)}`}
                    >
                      {agent.trust.score !== null && agent.trust.score !== undefined
                        ? agent.trust.score.toFixed(1)
                        : "—"}
                    </span>
                    {agent.trust.grade && (
                      <span className="text-[9px] font-mono text-[#555555] mt-0.5">
                        {agent.trust.grade}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {!loading && agents.length > 0 && (
          <div className="mt-6 flex items-center gap-2 text-[10px] font-mono text-[#444444]">
            <TrendingUp className="w-3 h-3" />
            <span>
              Trust scores are derived from ACP behavioral history — completion rate,
              payment reliability, and on-chain activity age.
            </span>
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================================================
// LEADERBOARD VIEW
// ============================================================================

function LeaderboardView({
  agents,
  loading,
  router,
  sortBy = "jobs",
}: {
  agents: Agent[];
  loading: boolean;
  router: ReturnType<typeof useRouter>;
  sortBy?: "trust" | "jobs";
}) {
  const [query, setQuery] = useState("");
  const [serverResults, setServerResults] = useState<Agent[]>([]);

  // Server-side search when query doesn't match local agents
  useEffect(() => {
    if (!query.trim()) { setServerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/agents?search=${encodeURIComponent(query.trim())}&limit=20&sort=${sortBy}`);
        const data = await res.json();
        setServerResults(data.agents?.map((a: any) => ({
          id: a.id, name: a.name, category: a.category, chain: a.chain,
          logo: a.logo, trust: a.trust, breakdown: a.breakdown,
        })) || []);
      } catch { setServerResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sortBy]);

  const sorted = [...agents]
    .sort((a, b) => sortBy === "jobs"
      ? (b.breakdown?.totalJobs ?? 0) - (a.breakdown?.totalJobs ?? 0)
      : (b.trust.score ?? -1) - (a.trust.score ?? -1));

  const top = query.trim()
    ? (serverResults.length > 0 ? serverResults : sorted.filter(a => a.name.toLowerCase().includes(query.toLowerCase()) || a.id.toLowerCase().includes(query.toLowerCase())))
    : sorted.slice(0, 50);

  const rankStyle = (i: number) => {
    if (i === 0) return "text-[#FFD700] text-lg";
    if (i === 1) return "text-[#C0C0C0] text-base";
    if (i === 2) return "text-[#CD7F32] text-base";
    return "text-[#444444] text-sm";
  };

  const rankLabel = (i: number) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `#${i + 1}`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[#E5E5E5]">
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-[#FFD700]" />
            <h1 className="text-xs font-mono text-[#666666] uppercase tracking-widest">
              // TRUST LEADERBOARD — TOP ACP AGENTS
            </h1>
          </div>
          <p className="text-[11px] text-[#444444] font-mono mt-1">
            Ranked by behavioral trust score · sourced from Virtuals ACP job history
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666666]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search by name or address..."
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] rounded px-3 py-2 pl-9 text-xs font-mono text-[#E5E5E5] placeholder-[#444] outline-none focus:border-[#3b82f6]/40 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Trophy className="w-6 h-6 text-[#FFD700] animate-pulse" />
          </div>
        ) : (
          <div className="space-y-2">
            {top.map((agent, i) => {
              const score = agent.trust.score;
              const verdict = scoreToVerdict(score);
              return (
                <div
                  key={agent.id}
                  onClick={() => router.push(`/agent/${cleanAgentName(agent.name)}/${agent.id}`)}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[#3b82f6]/30 hover:bg-[var(--bg-surface)] cursor-pointer transition-all group"
                >
                  {/* Rank */}
                  <div className={`w-10 text-center font-mono font-bold ${rankStyle(i)}`}>
                    {rankLabel(i)}
                  </div>

                  {/* Avatar */}
                  {agent.logo ? (
                    <img src={agent.logo} alt={agent.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 flex items-center justify-center text-xs font-bold text-[#3b82f6] flex-shrink-0">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Name + address */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#E5E5E5] truncate group-hover:text-white">
                      {agent.name}
                    </div>
                    <div className="text-[10px] font-mono text-[#444444] truncate">
                      {truncateAddress(agent.id)}
                    </div>
                  </div>

                  {/* Jobs + AGDP */}
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] font-mono text-[#444444]">JOBS</div>
                    <div className="text-xs font-mono text-[#888888]">
                      {agent.breakdown?.totalJobs?.toLocaleString() ?? "—"}
                    </div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-[10px] font-mono text-[#444444]">AGDP</div>
                    <div className="text-xs font-mono text-[#888888]">
                      {formatAgdp(agent.breakdown?.agdp)}
                    </div>
                  </div>

                  {/* Verdict badge */}
                  <div className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${verdictStyle(verdict)}`}>
                    {verdictLabel(verdict)}
                  </div>

                  {/* Score */}
                  <div className={`text-xl font-bold font-mono w-12 text-right ${trustScoreColor(score)}`}>
                    {score ?? "?"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

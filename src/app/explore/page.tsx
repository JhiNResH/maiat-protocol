"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Search, Shield, Bot, ArrowUpDown, TrendingUp, Zap } from "lucide-react";
import { isAddress } from "viem";

// ============================================================================
// TYPES
// ============================================================================

interface Agent {
  id: string;       // wallet address
  name: string;
  symbol?: string;
  chain: string;
  description?: string;
  trust: {
    score: number | null;
    grade: string | null;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function truncateAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/** Derive verdict from trust score (0–10 scale). */
function scoreToVerdict(score: number | null): "proceed" | "caution" | "avoid" | "unknown" {
  if (score === null || score === undefined) return "unknown";
  if (score >= 8.0) return "proceed";
  if (score >= 6.0) return "caution";
  return "avoid";
}

function verdictStyle(verdict: string) {
  switch (verdict) {
    case "proceed":
      return "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30";
    case "caution":
      return "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30";
    case "avoid":
      return "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30";
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
  if (score >= 8.0) return "text-[#22C55E]";
  if (score >= 6.0) return "text-[#F59E0B]";
  return "text-[#EF4444]";
}

function chainDot(chain: string) {
  switch (chain?.toLowerCase()) {
    case "base":
      return "bg-[#0052FF]";
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

export default function ExplorePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Shield className="w-8 h-8 text-[#0052FF] animate-pulse" />
            <span className="text-xs font-mono text-[#666666] uppercase tracking-widest">
              LOADING...
            </span>
          </div>
        </div>
      }
    >
      <ExplorePage />
    </Suspense>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function ExplorePage() {
  const router = useRouter();

  const [agents, setAgents]   = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState<"trust" | "jobs">("trust");

  // ── Fetch agents ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/agents?sort=trust&limit=100");
        const data = await res.json();
        if (Array.isArray(data.agents)) {
          setAgents(data.agents);
        }
      } catch (err) {
        console.error("[Explore] Failed to fetch agents:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Filter + Sort ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...agents];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const sa = a.trust.score ?? -1;
      const sb = b.trust.score ?? -1;
      return sb - sa; // always secondary sort by score
    });

    return result;
  }, [agents, search, sortBy]);

  const toggleSort = () => {
    setSortBy((prev) => (prev === "trust" ? "jobs" : "trust"));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5]">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-[#0052FF]" />
            <h1 className="text-xs font-mono text-[#666666] uppercase tracking-widest">
              // AI AGENT BROWSER — VIRTUALS ACP ECOSYSTEM
            </h1>
          </div>
          <div className="h-px bg-gradient-to-r from-[#0052FF]/50 via-[#1F1F1F] to-transparent" />
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
              className="w-full bg-[#111111] border border-[#1F1F1F] rounded px-3 py-2 pl-9 text-xs font-mono text-[#E5E5E5] placeholder-[#444] outline-none focus:border-[#0052FF]/40 transition-colors"
            />
          </div>

          {/* Sort */}
          <button
            onClick={toggleSort}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-wide bg-[#111111] border border-[#1F1F1F] rounded text-[#666666] hover:text-[#999] hover:border-[#333] transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === "trust" ? "SORT: TRUST ↓" : "SORT: JOBS ↓"}
          </button>

          {/* Agent Count */}
          {!loading && (
            <span className="text-[10px] font-mono text-[#555555] ml-auto">
              {filtered.length} agents
            </span>
          )}
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-[1fr_160px_120px_100px] gap-4 px-4 py-2 text-[9px] font-mono uppercase text-[#666666] tracking-wider border-b border-[#1F1F1F] mb-2">
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
                className="h-[68px] bg-[#111111] border border-[#1F1F1F] rounded-lg animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <div className="w-16 h-16 rounded-xl bg-[#111111] border border-[#1F1F1F] flex items-center justify-center">
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
                  ? isAddress(search)
                    ? "// this address has no ACP history yet"
                    : "// try a different name or paste a wallet address"
                  : "// Maiat indexes AI agents from the Virtuals ACP ecosystem and computes behavioral trust scores from on-chain job history. Check back soon."}
              </p>
            </div>
            {!search && (
              <div className="flex items-center gap-2 mt-2 px-4 py-2 bg-[#0052FF]/5 border border-[#0052FF]/20 rounded-lg">
                <Zap className="w-3.5 h-3.5 text-[#0052FF]" />
                <span className="text-xs font-mono text-[#0052FF]">
                  Agents are indexed automatically from Virtuals ACP on-chain activity
                </span>
              </div>
            )}
          </div>
        )}

        {/* Agent List */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-1">
            {filtered.map((agent, idx) => {
              const verdict = scoreToVerdict(agent.trust.score);
              return (
                <button
                  key={agent.id}
                  onClick={() => router.push(`/agent/${agent.id}`)}
                  className="group grid grid-cols-[1fr_160px_120px_100px] gap-4 items-center px-4 py-3 bg-[#111111] border border-[#1F1F1F] rounded-lg text-left transition-all duration-150 hover:border-[#0052FF]/50 hover:shadow-[0_0_16px_rgba(0,82,255,0.08)] cursor-pointer w-full"
                  style={{ minHeight: "68px" }}
                >
                  {/* Agent Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank */}
                    <span className="text-[9px] font-mono text-[#333333] w-5 shrink-0 text-right">
                      #{idx + 1}
                    </span>
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-[#0052FF]/10 border border-[#0052FF]/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold font-mono text-[#0052FF]">
                        {agent.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {/* Name + chain */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#E5E5E5] truncate group-hover:text-[#0052FF] transition-colors">
                        {agent.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${chainDot(agent.chain)}`} />
                        <span className="text-[9px] font-mono text-[#555555] uppercase">
                          {agent.chain || "base"}
                        </span>
                        {agent.symbol && (
                          <>
                            <span className="text-[#333333]">·</span>
                            <span className="text-[9px] font-mono text-[#555555]">
                              {agent.symbol}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex justify-center">
                    <span className="text-[10px] font-mono text-[#555555] bg-[#0A0A0A] border border-[#1F1F1F] px-2 py-1 rounded">
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
        {!loading && filtered.length > 0 && (
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

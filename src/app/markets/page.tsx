"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MarketCard } from "@/components/MarketCard";
import { Shield, TrendingUp, Clock, Trophy } from "lucide-react";

interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "closed" | "resolved";
  totalPool: number;
  positionCount: number;
  closesAt: string;
  topProjects: { projectId: string; totalStake: number }[];
}

export default function MarketsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center font-mono text-[#3b82f6]">LOADING…</div>}>
      <MarketsContent />
    </Suspense>
  )
}

function MarketsContent() {
  const searchParams = useSearchParams();
  const agentParam = searchParams.get("agent");
  const agentName = searchParams.get("name");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    fetchMarkets();
  }, []);

  async function fetchMarkets() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/markets?status=all");
      const data = await res.json();
      if (data.markets) {
        setMarkets(data.markets);
      }
    } catch (err) {
      console.error("Failed to fetch markets:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredMarkets = markets.filter((m) => {
    if (filter !== "all" && m.status !== filter) return false;
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
    return true;
  });

  const openMarkets = filteredMarkets.filter((m) => m.status === "open");
  const resolvedMarkets = filteredMarkets.filter((m) => m.status === "resolved");

  const totalPool = markets.reduce((acc, m) => acc + m.totalPool, 0);
  const totalPositions = markets.reduce((acc, m) => acc + m.positionCount, 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] font-['JetBrains_Mono',monospace]">
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Terminal Header */}
        <div className="mb-6">
          <h1 className="text-sm font-mono text-[#666666] uppercase tracking-widest mb-1">
            // OPINION MARKETS — STAKE SCARAB ON AGENT RANKINGS
          </h1>
          <div className="h-px bg-gradient-to-r from-[#3b82f6]/50 via-[#1F1F1F] to-transparent" />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Total Pool</span>
            </div>
            <span className="text-xl font-bold font-mono text-[#E5E5E5]">
              {totalPool.toLocaleString()} 🪲
            </span>
          </div>

          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-[#06b6d4]" />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Active Markets</span>
            </div>
            <span className="text-xl font-bold font-mono text-[#E5E5E5]">
              {markets.filter((m) => m.status === "open").length}
            </span>
          </div>

          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Total Positions</span>
            </div>
            <span className="text-xl font-bold font-mono text-[#E5E5E5]">
              {totalPositions}
            </span>
          </div>

          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-[#6366f1]" />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Resolved</span>
            </div>
            <span className="text-xl font-bold font-mono text-[#E5E5E5]">
              {markets.filter((m) => m.status === "resolved").length}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#666666] uppercase tracking-widest">Status:</span>
            <div className="flex gap-1.5">
              {(["all", "open", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wide rounded border transition-all ${
                    filter === f
                      ? "bg-[#3b82f6]/10 border-[#3b82f6]/40 text-[#3b82f6]"
                      : "border-[#1F1F1F] text-[#666666] hover:border-[#333] hover:text-[#999]"
                  }`}
                >
                  [{f.toUpperCase()}]
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#666666] uppercase tracking-widest">Category:</span>
            <div className="flex gap-1.5">
              {["all", "ai-agents"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wide rounded border transition-all ${
                    categoryFilter === cat
                      ? "bg-[#6366f1]/10 border-[#6366f1]/40 text-[#6366f1]"
                      : "border-[#1F1F1F] text-[#666666] hover:border-[#333] hover:text-[#999]"
                  }`}
                >
                  [{cat === "all" ? "ALL" : cat.replace("-", " ").toUpperCase()}]
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Shield className="w-8 h-8 text-[#3b82f6] animate-pulse" />
            <span className="text-xs font-mono text-[#666666] uppercase tracking-widest">
              LOADING MARKETS...
            </span>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredMarkets.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-14 h-14 rounded-lg bg-[#111111] border border-[#1F1F1F] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-[#666666]" />
            </div>
            <div>
              <p className="font-mono text-sm text-[#E5E5E5] mb-1">NO MARKETS FOUND</p>
              <p className="text-xs font-mono text-[#666666]">
                // check back soon for new prediction markets
              </p>
            </div>
          </div>
        )}

        {/* Markets Grid */}
        {!loading && filteredMarkets.length > 0 && (
          <div className="space-y-8">
            {/* Agent stake banner */}
            {agentParam && agentName && (
              <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg p-4 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-[#3b82f6] shrink-0" />
                <p className="text-sm font-mono text-[#E5E5E5]">
                  Stake on <strong className="text-[#3b82f6]">{decodeURIComponent(agentName)}</strong> — pick a market below
                </p>
              </div>
            )}
            {/* Active Markets */}
            {openMarkets.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-mono text-[#3b82f6] uppercase tracking-widest">
                    // ACTIVE MARKETS
                  </span>
                  <div className="flex-1 h-px bg-[#1F1F1F]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {openMarkets.map((market) => (
                    <MarketCard
                      key={market.id}
                      id={market.id}
                      title={market.title}
                      description={market.description}
                      category={market.category}
                      status={market.status}
                      totalPool={market.totalPool}
                      positionCount={market.positionCount}
                      closesAt={market.closesAt}
                      topProjects={market.topProjects}
                      agentParam={agentParam || undefined}
                      agentName={agentName || undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Resolved Markets */}
            {resolvedMarkets.length > 0 && filter !== "open" && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-mono text-[#666666] uppercase tracking-widest">
                    // RESOLVED MARKETS
                  </span>
                  <div className="flex-1 h-px bg-[#1F1F1F]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {resolvedMarkets.map((market) => (
                    <MarketCard
                      key={market.id}
                      id={market.id}
                      title={market.title}
                      description={market.description}
                      category={market.category}
                      status={market.status}
                      totalPool={market.totalPool}
                      positionCount={market.positionCount}
                      closesAt={market.closesAt}
                      topProjects={market.topProjects}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 pt-6 border-t border-[#1F1F1F]">
          <div className="text-xs font-mono text-[#666666] space-y-1">
            <p>// Markets resolve every 2 weeks. Top 3 projects by trust score win.</p>
            <p>// Winners split 95% of the loser pool. 5% is burned.</p>
            <p>// Minimum stake: 50 Scarab</p>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Star, Filter, Plus, Trophy, TrendingUp, Shield, Clock } from "lucide-react";
import { MarketCard } from "@/components/MarketCard";

interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "closed" | "resolved";
  totalPool: number;
  positionCount: number;
  voterCount?: number;
  closesAt: string;
  topProjects: { projectId: string; totalStake: number }[];
}

const categories = ["All", "AI Agents"];

export default function MarketsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--text-secondary)] text-sm uppercase tracking-widest">Loading…</div>
      </div>
    }>
      <MarketsContent />
    </Suspense>
  );
}

function MarketsContent() {
  const searchParams = useSearchParams();
  const agentParam = searchParams.get("agent");
  const agentName = searchParams.get("name");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("all");
  const [categoryFilter, setCategoryFilter] = useState("All");

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
    if (categoryFilter !== "All" && m.category !== categoryFilter.toLowerCase().replace(" ", "-")) return false;
    return true;
  });

  const openMarkets = filteredMarkets.filter((m) => m.status === "open");
  const resolvedMarkets = filteredMarkets.filter((m) => m.status === "resolved");
  const totalPool = markets.reduce((acc, m) => acc + m.totalPool, 0);
  const totalPositions = markets.reduce((acc, m) => acc + m.positionCount, 0);

  return (
    <div className="min-h-screen pb-20 relative">
      <main className="max-w-6xl mx-auto px-6 relative">
        {/* Hero */}
        <section className="text-center mb-20 pt-12">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-7xl font-black text-[var(--text-color)] tracking-tight"
          >
            Opinion <span className="text-[var(--text-muted)]">Markets</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto font-medium mt-6"
          >
            Stake Scarab on the agents you trust. Top picks win the pool.
          </motion.p>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {[
            { label: "Total Pool", value: `${totalPool.toLocaleString()} 🪲`, icon: TrendingUp },
            { label: "Active Markets", value: markets.filter((m) => m.status === "open").length, icon: Trophy },
            { label: "Total Positions", value: totalPositions, icon: Shield },
            { label: "Resolved", value: markets.filter((m) => m.status === "resolved").length, icon: Clock },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="liquid-glass p-8 rounded-[2.5rem] hover-lift"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">{stat.label}</p>
              <p className="text-3xl font-black text-[var(--text-color)]">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          {categories.map((cat, i) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                categoryFilter === cat
                  ? "bg-[var(--text-color)] text-[var(--bg-color)] shadow-lg shadow-black/5"
                  : "bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:border-gray-200 dark:hover:border-white/20"
              }`}
            >
              {cat}
            </button>
          ))}
          <div className="w-px h-8 bg-[var(--border-color)] mx-2" />
          <div className="flex gap-2">
            {(["all", "open", "resolved"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  filter === f
                    ? "bg-[var(--text-color)] text-[var(--bg-color)] border-transparent"
                    : "border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Shield className="w-8 h-8 text-[var(--text-secondary)] animate-pulse" />
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest">Loading Markets...</span>
          </div>
        )}

        {/* Agent stake banner */}
        {!loading && agentParam && agentName && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-[2rem] p-6 flex items-center gap-3 mb-8"
          >
            <Trophy className="w-5 h-5 text-[var(--text-color)] shrink-0" />
            <p className="text-sm text-[var(--text-color)]">
              Stake on <strong>{decodeURIComponent(agentName)}</strong> — pick a market below
            </p>
          </motion.div>
        )}

        {/* Markets - use MarketCard component for real data */}
        {!loading && filteredMarkets.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="liquid-glass rounded-[2.5rem] border-2 border-dashed border-[var(--border-color)] p-16 flex flex-col items-center justify-center text-center"
          >
            <div className="w-20 h-20 bg-[var(--bg-color)] rounded-full flex items-center justify-center text-[var(--text-muted)] mb-8 shadow-sm">
              <Plus size={40} />
            </div>
            <h3 className="font-display font-bold text-2xl mb-3 text-[var(--text-color)]">No markets found</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-10 max-w-[240px] font-medium">Check back soon for new prediction markets.</p>
          </motion.div>
        )}

        {!loading && filteredMarkets.length > 0 && (
          <div className="space-y-12">
            {openMarkets.length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Active Markets</h2>
                  <div className="flex-1 h-px bg-[var(--border-color)]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {openMarkets.map((market, i) => (
                    <motion.div
                      key={market.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <MarketCard
                        id={market.id}
                        title={market.title}
                        description={market.description}
                        category={market.category}
                        status={market.status}
                        totalPool={market.totalPool}
                        positionCount={market.positionCount}
                        voterCount={market.voterCount}
                        closesAt={market.closesAt}
                        topProjects={market.topProjects}
                        agentParam={agentParam || undefined}
                        agentName={agentName || undefined}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {resolvedMarkets.length > 0 && filter !== "open" && (
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Resolved Markets</h2>
                  <div className="flex-1 h-px bg-[var(--border-color)]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {resolvedMarkets.map((market, i) => (
                    <motion.div
                      key={market.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <MarketCard
                        id={market.id}
                        title={market.title}
                        description={market.description}
                        category={market.category}
                        status={market.status}
                        totalPool={market.totalPool}
                        positionCount={market.positionCount}
                        voterCount={market.voterCount}
                        closesAt={market.closesAt}
                        topProjects={market.topProjects}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-16 pt-8 border-t border-[var(--border-color)]">
          <div className="text-[10px] text-[var(--text-muted)] space-y-2 font-bold uppercase tracking-widest">
            <p>Markets resolve every 2 weeks. Top 3 agents by stake-weighted score win.</p>
            <p>Winners split 95% of the pool. 5% burned.</p>
            <p>Minimum stake: 50 🪲 Scarab</p>
          </div>
        </div>
      </main>
    </div>
  );
}

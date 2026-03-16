"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Shield, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Agent {
  address: string;
  name: string;
  category: string | null;
  image: string | null;
  trustScore: number;
  totalJobs: number;
}

const PAGE_SIZE = 25;

export default function AgentExplorer() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const q = debouncedQuery.length >= 2 ? debouncedQuery : "0x";
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
      if (!res.ok) { setAgents([]); return; }
      const data = await res.json();
      const results = data.agents || [];
      setAgents(results);
      setHasMore(results.length >= PAGE_SIZE);
    } catch {
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-blue-500";
    if (score >= 40) return "text-amber-500";
    return "text-rose-500";
  };

  const getVerdict = (score: number) => {
    if (score >= 80) return { label: "Trusted", bg: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    if (score >= 60) return { label: "Low Risk", bg: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    if (score >= 40) return { label: "Caution", bg: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400" };
    return { label: "Avoid", bg: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400" };
  };

  return (
    <div className="min-h-screen pb-20 relative">
      <main className="max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <section className="text-center mb-16 pt-12">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-7xl font-black text-[var(--text-color)] tracking-tight"
          >
            Agent <span className="text-[var(--text-muted)]">Explorer</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto font-medium mt-6"
          >
            18,600+ agents scored. Search by name or address.
          </motion.p>
        </section>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="relative">
            <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by agent name or 0x address..."
              className="w-full pl-14 pr-6 py-5 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] text-sm font-medium placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Shield className="w-8 h-8 text-[var(--text-secondary)] animate-pulse" />
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-widest">Searching agents...</span>
          </div>
        )}

        {/* Results Table */}
        {!loading && agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-[2.5rem] overflow-hidden"
          >
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-8 py-5 border-b border-[var(--border-color)]">
              <div className="col-span-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">#</div>
              <div className="col-span-5 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Agent</div>
              <div className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Score</div>
              <div className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Jobs</div>
              <div className="col-span-2 text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Verdict</div>
            </div>

            {/* Rows */}
            {agents.map((agent, i) => {
              const verdict = getVerdict(agent.trustScore);
              const rank = page * PAGE_SIZE + i + 1;
              return (
                <Link
                  key={agent.address}
                  href={`/?search=${agent.address}`}
                  className="grid grid-cols-12 gap-4 px-8 py-5 border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--text-color)]/[0.02] transition-colors group cursor-pointer"
                >
                  <div className="col-span-1 flex items-center">
                    <span className="text-sm font-bold text-[var(--text-muted)]">{rank}</span>
                  </div>
                  <div className="col-span-5 flex items-center gap-4 min-w-0">
                    {agent.image ? (
                      <img src={agent.image} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[var(--border-color)] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--text-color)] truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {agent.name}
                      </p>
                      <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                        {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <span className={cn("text-lg font-black tabular-nums", getScoreColor(agent.trustScore))}>
                      {agent.trustScore}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <span className="text-sm font-bold text-[var(--text-color)] tabular-nums">
                      {agent.totalJobs?.toLocaleString() ?? "—"}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <span className={cn("px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider", verdict.bg)}>
                      {verdict.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </motion.div>
        )}

        {/* Empty */}
        {!loading && agents.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[var(--text-secondary)] text-sm">No agents found. Try a different search.</p>
          </div>
        )}

        {/* Pagination */}
        {!loading && agents.length > 0 && (
          <div className="flex items-center justify-center gap-6 mt-12">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:border-[var(--text-color)]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Page {page + 1}
            </span>
            <button
              onClick={() => hasMore && setPage(page + 1)}
              disabled={!hasMore}
              className="flex items-center gap-2 px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-color)] hover:border-[var(--text-color)]/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

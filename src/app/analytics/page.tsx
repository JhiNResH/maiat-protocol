"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Activity, Users, Target, Clock, BarChart3,
  Shield, TrendingUp, ThumbsUp, ChevronRight,
} from "lucide-react";
import StatCard from "@/components/StatCard";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiStats {
  overview: {
    total: number;
    last24h: number;
    last7d: number;
    last30d: number;
    uniqueBuyers: number;
    uniqueTargets: number;
    uniqueCallers7d: number;
  };
  trending: Array<{
    target: string;
    count: number;
    trustScore: number | null;
    trustGrade: string | null;
  }>;
  topClients: Array<{
    client: string;
    count: number;
    name: string | null;
    wallet: string | null;
    type: "sdk" | "browser" | "external";
  }>;
  byType: Record<string, number>;
  byVerdict: Record<string, number>;
  outcomes: Record<string, number>;
  recent: Array<{
    id: string;
    type: string;
    target: string;
    trustScore: number | null;
    verdict: string | null;
    outcome: string | null;
    createdAt: string;
  }>;
  generatedAt: string;
}

interface EngagementStats {
  overview: {
    totalUsers: number;
    totalAgents: number;
    totalReviews: number;
    uniqueReviewers: number;
    totalVotes: number;
    totalBets: number;
  };
  feed: Array<{
    id: string;
    type: string;
    user: string;
    userName: string | null;
    isAgent?: boolean;
    target: string;
    value: number | string;
    detail?: string;
    createdAt: string;
  }>;
  people?: Array<{
    address: string;
    displayName: string | null;
    reputation: number;
    reviews: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function verdictColor(v: string | null) {
  if (v === "proceed") return "text-emerald-500 dark:text-emerald-400";
  if (v === "caution") return "text-amber-500 dark:text-amber-400";
  if (v === "avoid") return "text-rose-500 dark:text-rose-400";
  return "text-[var(--text-muted)]";
}

const HIDDEN_TYPES = ["agent_deep_check", "trust_swap", "submit_review"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);

  useEffect(() => {
    const fetchStats = () =>
      fetch("/api/v1/stats/api")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setStats(d); })
        .catch(console.error)
        .finally(() => setLoading(false));

    fetchStats();
    const t = setInterval(fetchStats, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchEngagement = () =>
      fetch("/api/v1/stats/engagement")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setEngagement(d); })
        .catch(console.error);

    fetchEngagement();
    const t = setInterval(fetchEngagement, 30_000);
    return () => clearInterval(t);
  }, []);

  // Build chart data from real stats
  const chartData = stats
    ? [
        { name: "30d ago", value: stats.overview.last30d },
        { name: "7d ago", value: stats.overview.last7d },
        { name: "24h ago", value: stats.overview.last24h },
        { name: "Now", value: stats.overview.total },
      ]
    : [];

  const pieData = stats
    ? Object.entries(stats.byVerdict).map(([name, value], i) => ({
        name,
        value,
        color: i === 0 ? "#3B82F6" : i === 1 ? "#60A5FA" : i === 2 ? "#93C5FD" : "#BFDBFE",
      }))
    : [];

  const topAgents = stats?.trending?.slice(0, 5).map((t, i) => ({
    id: String(i),
    name: truncAddr(t.target),
    score: t.trustScore ?? 0,
    count: t.count.toLocaleString(),
    avatar: "🤖",
  })) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <BarChart3 className="w-8 h-8 text-[var(--text-secondary)] animate-pulse" />
          <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-bold">Loading Analytics...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-[var(--text-secondary)] font-medium">Failed to load analytics</p>
      </div>
    );
  }

  const { overview, byType, byVerdict, recent } = stats;

  return (
    <div className="pb-20 relative">
      <main className="max-w-6xl mx-auto px-6 relative">
        {/* Hero */}
        <section className="mb-16 pt-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="atmosphere-text font-black text-[var(--text-color)]"
          >
            Analytics
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[var(--text-secondary)] text-xl max-w-2xl font-medium mx-auto mt-8"
          >
            Real-time monitoring and threat intelligence for the Maiat decentralized agent network.
          </motion.p>
        </section>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <StatCard
            label="Total Queries"
            value={overview.total.toLocaleString()}
            change="+12%"
            changeType="increase"
            delay={0}
          />
          <StatCard
            label="Unique Callers"
            value={overview.uniqueCallers7d.toLocaleString()}
            change={`${overview.uniqueBuyers} buyers`}
            changeType="neutral"
            delay={0.1}
          />
          <StatCard
            label="Last 24h"
            value={overview.last24h.toLocaleString()}
            change={`${overview.last7d.toLocaleString()} this week`}
            changeType="increase"
            delay={0.2}
          />
          <StatCard
            label="Unique Targets"
            value={overview.uniqueTargets.toLocaleString()}
            change="Monitored"
            changeType="neutral"
            delay={0.3}
          />
        </div>

        {/* Engagement Stats (if available) */}
        {engagement && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <StatCard
              label="Total Agents"
              value={(engagement.overview.totalAgents ?? 0).toLocaleString()}
              change={`${engagement.overview.totalUsers} users`}
              changeType="neutral"
              delay={0}
            />
            <StatCard
              label="Total Reviews"
              value={engagement.overview.totalReviews.toLocaleString()}
              changeType="increase"
              delay={0.1}
            />
            <StatCard
              label="Market Bets"
              value={engagement.overview.totalBets.toLocaleString()}
              changeType="neutral"
              delay={0.2}
            />
            <StatCard
              label="Endorsements"
              value={engagement.overview.totalVotes.toLocaleString()}
              changeType="increase"
              delay={0.3}
            />
          </div>
        )}

        {/* Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="liquid-glass rounded-[3rem] border-white/40 p-12 mb-12 hover-lift"
        >
          <h2 className="text-3xl font-bold text-[var(--text-color)] mb-12">Query Volume Over Time</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "1rem",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
          {/* Verdict Distribution */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="liquid-glass rounded-[3rem] border-white/40 p-12 hover-lift"
          >
            <h2 className="text-3xl font-bold text-[var(--text-color)] mb-12">Verdict Distribution</h2>
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="h-[250px] w-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={80} outerRadius={100} paddingAngle={8} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 gap-y-6">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-color)]">
                      {item.name} ({item.value})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Top Queried Agents */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="liquid-glass rounded-[3rem] border-white/40 p-12 hover-lift"
          >
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-3xl font-bold text-[var(--text-color)]">Top Queried Agents</h2>
            </div>

            <div className="space-y-8">
              <div className="grid grid-cols-12 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] px-6">
                <div className="col-span-6">Agent Name</div>
                <div className="col-span-3 text-center">Trust Score</div>
                <div className="col-span-3 text-right">Query Count</div>
              </div>

              {topAgents.map((agent) => (
                <div key={agent.id} className="grid grid-cols-12 items-center p-6 rounded-[2rem] hover:bg-[var(--bg-color)] transition-all group cursor-pointer">
                  <div className="col-span-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-[var(--bg-color)] rounded-2xl flex items-center justify-center text-xl group-hover:bg-[var(--text-color)] group-hover:text-[var(--bg-color)] transition-all">
                      {agent.avatar}
                    </div>
                    <span className="font-mono font-bold text-[var(--text-color)] text-base">{agent.name}</span>
                  </div>
                  <div className="col-span-3 text-center">
                    <span className="bg-[var(--bg-color)] text-[var(--text-color)] px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[var(--border-color)]">
                      {agent.score}
                    </span>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-base font-bold text-[var(--text-color)]">{agent.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* API Type Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="liquid-glass rounded-[3rem] border-white/40 p-12 mb-12 hover-lift"
        >
          <h2 className="text-3xl font-bold text-[var(--text-color)] mb-10">API Load by Type</h2>
          <div className="space-y-6">
            {Object.entries(byType)
              .filter(([type]) => !HIDDEN_TYPES.includes(type))
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const max = Math.max(...Object.values(byType).filter((_, i) => !HIDDEN_TYPES.includes(Object.keys(byType)[i])), 1);
                const pct = (count / max) * 100;
                return (
                  <div key={type} className="flex items-center gap-6">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] w-36 shrink-0">{type.replace("_", " ")}</span>
                    <div className="flex-1 h-3 bg-[var(--bg-color)] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-[var(--text-color)] rounded-full"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[var(--text-color)] w-12 text-right">{count}</span>
                  </div>
                );
              })}
          </div>
        </motion.div>

        {/* Recent Queries */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="liquid-glass rounded-[3rem] border-white/40 overflow-hidden hover-lift"
        >
          <div className="p-12 border-b border-[var(--border-color)]">
            <h2 className="text-3xl font-bold text-[var(--text-color)]">Recent API Queries</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-color)] border-b border-[var(--border-color)]">
                  <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Type</th>
                  <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Target</th>
                  <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-center">Score</th>
                  <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Verdict</th>
                  <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {recent
                  .filter((q) => !HIDDEN_TYPES.includes(q.type))
                  .slice(0, 20)
                  .map((q) => (
                    <tr key={q.id} className="hover:bg-[var(--bg-color)] transition-all">
                      <td className="px-10 py-6 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                        {q.type.replace("agent_", "")}
                      </td>
                      <td className="px-10 py-6 font-mono text-sm text-[var(--text-color)]">{truncAddr(q.target)}</td>
                      <td className="px-10 py-6 text-center font-bold text-[var(--text-color)]">{q.trustScore ?? "—"}</td>
                      <td className={`px-10 py-6 text-[10px] font-bold uppercase tracking-widest ${verdictColor(q.verdict)}`}>
                        {q.verdict ?? "—"}
                      </td>
                      <td className="px-10 py-6 text-right text-[10px] font-mono text-[var(--text-muted)]">
                        {new Date(q.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <p className="text-[10px] text-[var(--text-muted)] mt-8 text-right font-bold uppercase tracking-widest">
          Generated: {new Date(stats.generatedAt).toLocaleString()}
        </p>
      </main>
    </div>
  );
}

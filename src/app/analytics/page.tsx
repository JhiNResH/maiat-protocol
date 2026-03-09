"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, Users, Target, Clock } from "lucide-react";

interface ApiStats {
  overview: {
    total: number;
    last24h: number;
    last7d: number;
    last30d: number;
    uniqueBuyers: number;
    uniqueTargets: number;
  };
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

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Activity; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-[#3b82f6]" />
        <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-mono font-bold text-[#E5E5E5]">{value}</div>
      {sub && <div className="text-[10px] font-mono text-[#444] mt-1">{sub}</div>}
    </div>
  );
}

function TypeBar({ type, count, max }: { type: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const colors: Record<string, string> = {
    agent_trust: "bg-[#3b82f6]",
    token_check: "bg-[#10b981]",
    trust_swap: "bg-[#f59e0b]",
  };
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-mono text-[#888] w-28 truncate">{type}</span>
      <div className="flex-1 h-5 bg-[var(--bg-surface)] rounded overflow-hidden">
        <div className={`h-full ${colors[type] || "bg-[#666]"} rounded transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-[#666] w-12 text-right">{count}</span>
    </div>
  );
}

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function verdictColor(v: string | null) {
  if (v === "proceed") return "text-[#10b981]";
  if (v === "caution") return "text-[#f59e0b]";
  if (v === "avoid") return "text-[#ef4444]";
  return "text-[#555]";
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/stats/api")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (!stats) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[#555] font-mono text-sm">
        Failed to load analytics
      </div>
    );
  }

  const { overview, byType, byVerdict, outcomes, recent } = stats;
  const maxType = Math.max(...Object.values(byType), 1);

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[#E5E5E5]">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-[#3b82f6]" />
          <h1 className="text-xs font-mono text-[#666] uppercase tracking-widest">
            // API ANALYTICS
          </h1>
        </div>
        <div className="h-px bg-gradient-to-r from-[#3b82f6]/50 via-[#1F1F1F] to-transparent mb-8" />

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={Activity} label="Total Queries" value={overview.total} />
          <StatCard icon={Clock} label="Last 24h" value={overview.last24h} sub={`${overview.last7d} this week`} />
          <StatCard icon={Users} label="Unique Buyers" value={overview.uniqueBuyers} />
          <StatCard icon={Target} label="Unique Targets" value={overview.uniqueTargets} />
        </div>

        {/* Type + Verdict */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
            <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-4">By Type</h2>
            <div className="space-y-2">
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <TypeBar key={type} type={type} count={count} max={maxType} />
              ))}
              {Object.keys(byType).length === 0 && <p className="text-[11px] font-mono text-[#444]">No data yet</p>}
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
            <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-4">Verdicts</h2>
            <div className="space-y-2">
              {Object.entries(byVerdict).sort((a, b) => b[1] - a[1]).map(([verdict, count]) => (
                <div key={verdict} className="flex justify-between items-center">
                  <span className={`text-xs font-mono uppercase ${verdictColor(verdict)}`}>{verdict}</span>
                  <span className="text-xs font-mono text-[#666]">{count}</span>
                </div>
              ))}
            </div>

            <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider mt-6 mb-3">Outcomes</h2>
            <div className="space-y-2">
              {Object.entries(outcomes).sort((a, b) => b[1] - a[1]).map(([outcome, count]) => (
                <div key={outcome} className="flex justify-between items-center">
                  <span className="text-xs font-mono text-[#888]">{outcome}</span>
                  <span className="text-xs font-mono text-[#666]">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Queries */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
          <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-4">Recent Queries</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[10px] text-[#444] uppercase border-b border-[var(--border-default)]">
                  <th className="text-left py-2 pr-3">Type</th>
                  <th className="text-left py-2 pr-3">Target</th>
                  <th className="text-right py-2 pr-3">Score</th>
                  <th className="text-left py-2 pr-3">Verdict</th>
                  <th className="text-left py-2 pr-3">Outcome</th>
                  <th className="text-right py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((q) => (
                  <tr key={q.id} className="border-b border-[#111] hover:bg-[var(--bg-surface)]">
                    <td className="py-2 pr-3 text-[#3b82f6]">{q.type}</td>
                    <td className="py-2 pr-3 text-[#888]">{truncAddr(q.target)}</td>
                    <td className="py-2 pr-3 text-right text-[#E5E5E5]">{q.trustScore ?? "—"}</td>
                    <td className={`py-2 pr-3 ${verdictColor(q.verdict)}`}>{q.verdict ?? "—"}</td>
                    <td className="py-2 pr-3 text-[#666]">{q.outcome ?? "—"}</td>
                    <td className="py-2 text-right text-[#444]">{new Date(q.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-[#444]">No queries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] font-mono text-[#333] mt-4 text-right">
          Generated: {new Date(stats.generatedAt).toLocaleString()}
        </p>
      </main>
    </div>
  );
}

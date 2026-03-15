"use client";

import { useEffect, useState } from "react";
import { Footer } from "@/components/Footer";
import { 
  Activity, Users, Target, Clock, BarChart3, 
  Shield, ExternalLink, ArrowUpRight, TrendingUp,
  ThumbsUp,
  ArrowDownRight,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

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
    type: 'sdk' | 'browser' | 'external' 
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

function TypeBar({ type, count, max }: { type: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  const colors: Record<string, string> = {
    agent_trust: "bg-[#3b82f6]",
    token_check: "bg-[#10b981]",
    agent_profile: "bg-[#8b5cf6]",
    token_forensics: "bg-[#facc15]",
  };
  // Hide deprecated offerings from display
  const HIDDEN_TYPES = ["agent_deep_check", "trust_swap", "submit_review"];
  if (HIDDEN_TYPES.includes(type)) return null;
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

const StatCard = ({ label, value, sub, icon: Icon }: any) => {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] p-4 rounded-xl">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-[#555]" />
        <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold font-mono text-[#E5E5E5]">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <p className="text-[9px] font-mono text-[#333] mt-1">{sub}</p>}
    </div>
  );
};

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function verdictColor(v: string | null) {
  if (v === "proceed") return "text-[#10b981]";
  if (v === "caution") return "text-[#f59e0b]";
  if (v === "avoid") return "text-[#ef4444]";
  return "text-[#555]";
}

const UserCard = ({ user, index }: { user: any; index: number }) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-[10px] font-mono text-[#333]">#{(index + 1).toString().padStart(2, '0')}</div>
        <div>
          <div className="text-xs font-medium text-[#AAA]">{user.displayName || truncAddr(user.address)}</div>
          <div className="text-[9px] font-mono text-[#555] uppercase">{user.totalReviews} Reviews</div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold font-mono text-[#a855f7]">{user.reputationScore}</div>
        <div className="text-[8px] font-mono text-[#444] uppercase">Score</div>
      </div>
    </div>
  );
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<{
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
  } | null>(null);

  useEffect(() => {
    const fetchStats = () =>
      fetch("/api/v1/stats/api")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setStats(d) })
        .catch(console.error)
        .finally(() => setLoading(false));

    fetchStats();
    const statsTimer = setInterval(fetchStats, 30_000);
    return () => clearInterval(statsTimer);
  }, []);

  useEffect(() => {
    const fetchEngagement = () =>
      fetch("/api/v1/stats/engagement")
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setEngagement(d) })
        .catch(console.error);

    fetchEngagement();
    const engagementTimer = setInterval(fetchEngagement, 30_000);
    return () => clearInterval(engagementTimer);
  }, []);

  if (!stats) {
    if (loading) {
      return (
        <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center text-[#555] font-mono text-sm">
          // LOADING LOGISTICS...
        </div>
      );
    }
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
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#3b82f6]" />
            <h1 className="text-xs font-mono text-[#666] uppercase tracking-widest">
              // PLATFORM ANALYTICS
            </h1>
          </div>
          <div className="text-[9px] font-mono text-[#333] italic">
            * Real-time behavioral transparency enabled
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-[#3b82f6]/50 via-[#1F1F1F] to-transparent mb-8" />

        {/* API Usage Section */}
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-3.5 h-3.5 text-[#3b82f6]" />
          <h2 className="text-[10px] font-mono text-[#888] uppercase tracking-widest">API Logistics</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={Activity} label="Total Queries" value={overview.total} />
          <StatCard icon={Clock} label="Last 24h" value={overview.last24h} sub={`${overview.last7d} this week`} />
          <StatCard icon={Users} label="Unique Callers" value={overview.uniqueCallers7d} sub={`${overview.uniqueBuyers} registered buyers`} />
          <StatCard icon={Target} label="Unique Targets" value={overview.uniqueTargets} />
        </div>

        {/* Engagement Section */}
        {engagement && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-3.5 h-3.5 text-[#a855f7]" />
              <h2 className="text-[10px] font-mono text-[#888] uppercase tracking-widest">User Engagement</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard 
                icon={Shield} 
                label="Total Protected Nodes" 
                value={(engagement.overview.totalAgents ?? 0).toLocaleString()} 
                sub={`${engagement.overview.totalUsers} connected users`} 
              />
              <StatCard icon={Activity} label="Total Reviews" value={engagement.overview.totalReviews} />
              <StatCard icon={Target} label="Market Bets" value={engagement.overview.totalBets} />
              <StatCard 
                icon={ThumbsUp} 
                label="Endorsements" 
                value={engagement.overview.totalVotes} 
                sub="Helpful votes on intel"
              />
            </div>

            {/* Human Guardians Section */}
            {engagement?.people && engagement.people.length > 0 && (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-3.5 h-3.5 text-[#a855f7]" />
                  <h2 className="text-[10px] font-mono text-[#888] uppercase tracking-widest text-[#a855f7]/70">Verified Human Guardians (ACP)</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {engagement.people.slice(0, 10).map((person) => (
                    <div key={person.address} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-2 hover:border-white/10 transition-all">
                      <div className="text-[10px] font-bold text-[#AAA] truncate mb-0.5" title={person.displayName || person.address}>
                        {person.displayName || truncAddr(person.address)}
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-mono">
                        <span className="text-[#444]" title="Base reputation + participation points">Reputation</span>
                        <span className="text-[#a855f7]">{person.reputation} <span className="text-[7px] text-[#444] opacity-50">Score</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Type + Verdict */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
            <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-4">API Load by Type</h2>
            <div className="space-y-2">
              {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <TypeBar key={type} type={type} count={count} max={maxType} />
              ))}
            </div>
          </div>

          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
            <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-4">API Verdict Distribution</h2>
            <div className="space-y-2">
              {Object.entries(byVerdict).sort((a, b) => b[1] - a[1]).map(([verdict, count]) => (
                <div key={verdict} className="flex justify-between items-center">
                  <span className={`text-xs font-mono uppercase ${verdictColor(verdict)}`}>{verdict}</span>
                  <span className="text-xs font-mono text-[#666]">{count}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-[#111]">
              <div className="flex items-center gap-2 mb-3 grayscale opacity-30">
                <Activity className="w-3.5 h-3.5 text-[#555]" />
                <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider">SDK Network Activity</h2>
              </div>
              <p className="text-[10px] font-mono text-[#333] italic">
                 SDK identity tracking active in secure backend registry. External adoption pending detection.
              </p>
            </div>
          </div>
        </div>

        {/* Network Heatmap Section */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-[#ef4444]" />
              <h2 className="text-[10px] font-mono text-[#888] uppercase tracking-widest">Network Heatmap (Trending Targets)</h2>
            </div>
            <div className="text-[9px] font-mono text-[#333] italic">
              * Critical training feed for Wadjet Sentinel
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {stats.trending?.map((t) => (
              <div key={t.target} className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg p-3 hover:border-white/10 transition-all group">
                <div className="text-[10px] font-bold text-[#E5E5E5] truncate mb-1" title={t.target}>
                  {truncAddr(t.target)}
                </div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-mono text-[#555]">Query Heat</span>
                  <span className="text-[10px] font-mono text-[#ef4444] font-bold animate-pulse">{t.count}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] font-mono">
                  <span className="text-[#444]">Trust</span>
                  <span className={t.trustGrade ? (t.trustGrade.startsWith('A') ? 'text-[#10b981]' : t.trustGrade.startsWith('C') ? 'text-[#f59e0b]' : 'text-[#ef4444]') : 'text-[#333]'}>
                    {t.trustGrade || 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two Columns for Feeds */}
        <div className="grid md:grid-cols-5 gap-6 mb-8">
          {/* Recent API Queries */}
          <div className="md:col-span-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
            <h2 className="text-[10px] font-mono text-[#555] uppercase tracking-wider mb-4">Recent API Queries</h2>
            <div className="max-h-[500px] overflow-y-auto pr-1">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[10px] text-[#444] uppercase border-b border-[#111] sticky top-0 bg-[var(--bg-surface)] z-10">
                    <th className="text-left py-2 pr-3">Type</th>
                    <th className="text-left py-2 pr-3">Target</th>
                    <th className="text-right py-2 pr-3">Score</th>
                    <th className="text-left py-2 pr-3">Verdict</th>
                    <th className="text-right py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.filter((q) => !["agent_deep_check", "trust_swap", "submit_review"].includes(q.type)).slice(0, 50).map((q) => (
                    <tr key={q.id} className="border-b border-[#111] hover:bg-[#111]/30">
                      <td className="py-2 pr-3 text-[#3b82f6] truncate max-w-[80px]">{q.type.replace('agent_', '')}</td>
                      <td className="py-2 pr-3 text-[#555]">{truncAddr(q.target)}</td>
                      <td className="py-2 pr-3 text-right text-[#E5E5E5] font-bold">{q.trustScore ?? "—"}</td>
                      <td className={`py-2 pr-3 ${verdictColor(q.verdict)}`}>{q.verdict ?? "—"}</td>
                      <td className="py-2 text-right text-[#333]">
                        {(() => {
                          const d = new Date(q.createdAt);
                          const isToday = d.toDateString() === new Date().toDateString();
                          return isToday 
                            ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Engagement Feed */}
          <div className="md:col-span-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-4">
            <h2 className="text-[10px] font-mono text-[#a855f7] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Live Engagement
            </h2>
            <div className="max-h-[500px] overflow-y-auto pr-1">
              <div className="space-y-4">
                {engagement?.feed.map((item) => (
                  <div key={item.id} className="border-l border-[var(--border-default)] pl-3 py-1 hover:border-white/20 transition-all">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className={`text-[10px] font-mono uppercase ${
                        item.type === 'review' ? 'text-[#3b82f6]' : 
                        item.type === 'bet' ? 'text-[#a855f7]' : 
                        'text-[#10b981]'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-[9px] font-mono text-[#333]">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#AAA] mb-1">
                      <span className="text-[#E5E5E5] font-mono flex items-center gap-1 flex-wrap">
                        {item.isAgent ? '🤖' : '👤'} {item.userName || truncAddr(item.user)}
                      </span>
                      <span className="text-[#666]">
                        {item.type === 'review' ? ' rated ' : item.type === 'bet' ? ' bet ' : ' voted '}
                      </span>
                      <span className="text-[#E5E5E5] font-mono">{truncAddr(item.target)}</span>
                      <span className="text-[#E5E5E5] font-mono ml-1">
                        {item.type === 'review' ? `[${item.value}/10]` : 
                         item.type === 'bet' ? `[${item.value} 🪲]` : 
                         `[${item.value === 1 ? '👍' : '👎'}]`}
                      </span>
                    </div>
                    {item.detail && (
                      <div className="text-[10px] italic text-[#555] line-clamp-1">"{item.detail}"</div>
                    )}
                  </div>
                ))}
                {engagement?.feed.length === 0 && (
                  <p className="text-[10px] font-mono text-[#444] py-4 text-center">Waiting for activity...</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] font-mono text-[#333] mt-4 text-right">
          Generated: {new Date(stats.generatedAt).toLocaleString()}
        </p>
      </main>
      <Footer />
    </div>
  );
}

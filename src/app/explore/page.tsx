"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import {
  Search,
  TrendingUp,
  Trophy,
  Scan,
  MessageSquare,
  ChevronRight,
  Star,
  X,
  Shield,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { isAddress } from "viem";

// ============================================================================
// TYPES
// ============================================================================

interface ExploreItem {
  id: string;
  address: string;
  slug: string;
  name: string;
  category: string;
  chain: string;
  trustScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  txCount: number;
  reviewCount: number;
  ageLabel: string;
  starRating: number;
  description: string;
  iconLetter: string;
  iconColor: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function scoreColor(score: number) {
  if (score >= 7.0) return "text-emerald-400";
  if (score >= 4.0) return "text-amber-400";
  return "text-red-400";
}

function scoreBgBorder(score: number) {
  if (score >= 7.0) return "bg-emerald-500/8 border-emerald-500/20";
  if (score >= 4.0) return "bg-amber-500/8 border-amber-500/20";
  return "bg-red-500/8 border-red-500/20";
}

function riskBadge(level: string) {
  switch (level) {
    case "LOW":      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "MEDIUM":   return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "HIGH":     return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "CRITICAL": return "bg-red-500/10 text-red-400 border-red-500/20";
    default:         return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
  }
}

function chainBadge(chain: string) {
  switch (chain?.toLowerCase()) {
    case 'base': return 'bg-[#0052FF]/10 text-[#0052FF] border-[#0052FF]/25';
    case 'ethereum': case 'eth': return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
    default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  }
}

function chainLabel(chain: string) {
  switch (chain?.toLowerCase()) {
    case 'base': return 'Base';
    case 'ethereum': case 'eth': return 'ETH';
    default: return chain;
  }
}

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

function categoryColor(cat: string) {
  if (cat === 'Agent') return '#0052FF';
  if (cat === 'DeFi' || cat === 'DEX') return '#7C3AED';
  if (cat === 'Lending') return '#0EA5E9';
  return '#475569';
}

// ============================================================================
// WRAPPER
// ============================================================================

export default function ExplorePageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-[#0052FF] animate-pulse" />
          <span className="text-xs font-mono text-[#475569] uppercase tracking-widest">Loading...</span>
        </div>
      </div>
    }>
      <ExplorePage />
    </Suspense>
  );
}

// ============================================================================
// MAIN
// ============================================================================

function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated } = usePrivy();

  const [activeTab, setActiveTab]   = useState<'explore' | 'leaderboard'>('explore');
  const [category, setCategory]     = useState("all");
  const [sortBy, setSortBy]         = useState("score_desc");
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [items, setItems]           = useState<ExploreItem[]>([]);

  // review modal
  const [reviewOpen, setReviewOpen]   = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ExploreItem | null>(null);
  const [reviewForm, setReviewForm]   = useState({ rating: 0, comment: "" });
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'leaderboard' ? 'leaderboard' : 'explore');
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => { fetchProjects(); }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res  = await fetch("/api/v1/explore");
      const data = await res.json();
      if (data.projects) {
        const mapped: ExploreItem[] = data.projects.map((p: any) => ({
          id:          p.id,
          address:     p.address,
          slug:        p.slug || p.name.toLowerCase().replace(/\s+/g, '-'),
          name:        p.name,
          category:    p.category,
          chain:       p.chain,
          trustScore:  p.trustScore,
          riskLevel:   p.trustScore >= 7.0 ? "LOW" : p.trustScore >= 4.0 ? "MEDIUM" : "HIGH",
          txCount:     0,
          reviewCount: p.reviewCount || 0,
          ageLabel:    "Active",
          starRating:  p.avgRating || 0,
          description: p.description || "No description provided.",
          iconLetter:  p.name.charAt(0),
          iconColor:   categoryColor(p.category),
        }));
        setItems(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch explore projects:", err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let result = [...items];

    if (category !== "all") {
      const catMap: Record<string, string[]> = {
        defi:   ["DEX", "Lending", "DeFi"],
        agents: ["Agent"],
      };
      const allowed = catMap[category] || [];
      result = result.filter(item => allowed.includes(item.category));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "score_desc":    result.sort((a, b) => b.trustScore - a.trustScore); break;
      case "most_reviewed": result.sort((a, b) => b.reviewCount - a.reviewCount); break;
    }

    if (activeTab === 'leaderboard') {
      result = result.sort((a, b) => b.trustScore - a.trustScore);
    }

    return result;
  }, [category, search, sortBy, items, activeTab]);

  async function submitReview() {
    if (!reviewTarget || reviewForm.rating === 0 || !authenticated) return;
    setSubmitting(true);
    try {
      await fetch("/api/v1/review", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ address: reviewTarget.address, rating: reviewForm.rating, comment: reviewForm.comment }),
      });
      setReviewOpen(false);
      setReviewForm({ rating: 0, comment: "" });
      fetchProjects();
    } catch {}
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-[#050508] text-[#f1f5f9]">
      <Header />

      <main className="max-w-3xl mx-auto px-4 py-8">

        {/* Tab Bar */}
        <div className="flex gap-1 mb-6 border-b border-[#1e2035] pb-1">
          {[
            { id: 'explore',     label: 'Explore',     icon: TrendingUp },
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                router.push(tab.id === 'leaderboard' ? '/explore?tab=leaderboard' : '/explore');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-t-md -mb-px border-b-2 ${
                activeTab === tab.id
                  ? 'border-[#0052FF] text-[#0052FF]'
                  : 'border-transparent text-[#475569] hover:text-[#94a3b8]'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters Row */}
        <div className="flex items-center justify-between gap-4 mb-6">
          {/* Category Chips */}
          <div className="flex gap-2">
            {["all", "agents", "defi"].map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  category === cat
                    ? 'bg-[#0052FF]/10 border-[#0052FF]/40 text-[#0052FF]'
                    : 'border-[#1e2035] text-[#475569] hover:border-[#2a2d45] hover:text-[#94a3b8]'
                }`}
              >
                {cat === 'all' ? 'All' : cat === 'agents' ? 'AI Agents' : 'DeFi'}
              </button>
            ))}
          </div>

          {/* Sort */}
          {activeTab === 'explore' && (
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs bg-[#0d0e17] border border-[#1e2035] text-[#94a3b8] rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-[#2a2d45] transition-all"
            >
              <option value="score_desc">Highest Trust Score</option>
              <option value="most_reviewed">Most Reviewed</option>
            </select>
          )}
        </div>

        {/* Empty / No Match */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#0052FF]/8 border border-[#0052FF]/15 flex items-center justify-center">
              <Scan className="w-7 h-7 text-[#0052FF]/60" />
            </div>
            <div>
              <p className="font-semibold text-[#f1f5f9] mb-1">
                {search ? `No results for "${search}"` : 'No projects found'}
              </p>
              <p className="text-sm text-[#475569]">
                {isAddress(search ?? '')
                  ? "This address isn't indexed yet."
                  : 'Try a different filter or search.'}
              </p>
            </div>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-28 bg-[#0d0e17] border border-[#1e2035] rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Project List */}
        {!loading && (
          <div className="flex flex-col gap-2">
            {filtered.map((item, idx) => (
              <div
                key={item.id}
                className="group bg-[#0d0e17] border border-[#1e2035] hover:border-[#2a2d45] rounded-xl p-4 flex items-start gap-4 transition-all hover:bg-[#13141f]"
              >
                {/* Rank / Icon */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  {activeTab === 'leaderboard' ? (
                    <span className="text-xs font-bold font-mono text-[#475569] w-6 text-center">
                      #{idx + 1}
                    </span>
                  ) : (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: item.iconColor + '22', color: item.iconColor, border: `1px solid ${item.iconColor}33` }}
                    >
                      {item.iconLetter}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Name row */}
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      href={`/agent/${item.slug}`}
                      className="font-semibold text-[#f1f5f9] hover:text-[#0052FF] transition-colors"
                    >
                      {item.name}
                    </Link>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${chainBadge(item.chain)}`}>
                      {chainLabel(item.chain)}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#13141f] border border-[#1e2035] text-[#475569]">
                      {item.category}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-[#64748b] line-clamp-2 mb-3 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Bottom actions row */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <Link
                      href={`/agent/${item.slug}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-[#475569] hover:text-[#94a3b8] hover:bg-[#1e2035] transition-all"
                    >
                      <ChevronRight className="w-3 h-3" />
                      View Details
                    </Link>
                    <button
                      onClick={() => { setReviewTarget(item); setReviewOpen(true); }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-[#475569] hover:text-[#94a3b8] hover:bg-[#1e2035] transition-all"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Write Review
                    </button>
                    {item.reviewCount > 0 && (
                      <span className="px-2.5 py-1 text-xs text-[#475569]">
                        {item.reviewCount} review{item.reviewCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Trust Score Panel */}
                <div className={`shrink-0 flex flex-col items-center justify-center px-4 py-3 rounded-xl border ${scoreBgBorder(item.trustScore)} min-w-[72px]`}>
                  <span className={`text-2xl font-bold font-mono leading-none ${scoreColor(item.trustScore)}`}>
                    {item.trustScore.toFixed(1)}
                  </span>
                  <span className="text-[9px] font-medium text-[#475569] uppercase tracking-wider mt-1">Trust</span>
                  <span className={`text-[9px] font-bold uppercase tracking-wide mt-1.5 px-1.5 py-0.5 rounded border ${riskBadge(item.riskLevel)}`}>
                    {item.riskLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Review Modal */}
      {reviewOpen && reviewTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setReviewOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#0d0e17] border border-[#1e2035] rounded-2xl shadow-2xl shadow-black/50">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#1e2035] flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-[#475569] uppercase tracking-widest mb-0.5">Submit Review</p>
                <h3 className="font-semibold text-[#f1f5f9]">{reviewTarget.name}</h3>
              </div>
              <button onClick={() => setReviewOpen(false)} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {/* Star Rating */}
              <div>
                <p className="text-xs text-[#475569] mb-3">Trust Rating</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewForm(p => ({ ...p, rating: star }))}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all border ${
                        reviewForm.rating >= star
                          ? "text-[#d4a017] bg-[#d4a017]/10 border-[#d4a017]/30 scale-105"
                          : "text-[#1e2035] bg-[#13141f] border-[#1e2035] hover:border-[#2a2d45]"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div>
                <p className="text-xs text-[#475569] mb-2">Analysis <span className="text-[#2a2d45]">(optional)</span></p>
                <textarea
                  value={reviewForm.comment}
                  onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                  placeholder="Share your technical assessment, on-chain observations, or interaction outcome..."
                  rows={4}
                  className="w-full p-4 bg-[#13141f] border border-[#1e2035] focus:border-[#0052FF]/40 rounded-xl text-sm text-[#f1f5f9] placeholder-[#2a2d45] outline-none resize-none transition-all"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-[#475569]">Costs <span className="text-[#d4a017] font-mono">2 🪲</span></p>
                <button
                  onClick={submitReview}
                  disabled={submitting || reviewForm.rating === 0 || !authenticated}
                  className="px-6 py-2.5 bg-[#0052FF] hover:bg-[#0041cc] disabled:opacity-40 text-white rounded-xl font-medium text-sm transition-all"
                >
                  {!authenticated ? 'Connect Wallet' : submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

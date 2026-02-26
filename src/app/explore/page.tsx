"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import {
  Search,
  TrendingUp,
  Clock,
  HelpCircle,
  Star,
  Send,
  X,
  ArrowRight,
  MessageSquare,
  SlidersHorizontal,
  Scan,
  ArrowBigUp,
  ArrowDown,
  Trophy,
  Feather
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
  latestReview: string;
  iconLetter: string;
  iconColor: string;
  votes?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function scoreColor(score: number) {
  if (score >= 7.0) return "text-green-400";
  if (score >= 4.0) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 7.0) return "bg-green-500/15 border-green-500/30";
  if (score >= 4.0) return "bg-yellow-500/15 border-yellow-500/30";
  return "bg-red-500/15 border-red-500/30";
}

function riskBadge(level: string) {
  switch (level) {
    case "LOW": return "bg-green-500/15 text-green-400";
    case "MEDIUM": return "bg-yellow-500/15 text-yellow-400";
    case "HIGH": return "bg-orange-500/15 text-orange-400";
    case "CRITICAL": return "bg-red-500/15 text-red-400";
    default: return "bg-zinc-500/15 text-zinc-400";
  }
}

function formatNum(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return n.toString();
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`text-xs ${i <= Math.round(rating) ? "text-gold" : "text-zinc-600"}`}>★</span>
      ))}
    </span>
  );
}

// ============================================================================
// MAIN WRAPPER
// ============================================================================

export default function ExplorePageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030303] flex items-center justify-center text-gold font-mono uppercase tracking-widest animate-pulse">Initializing Hub...</div>}>
      <ExplorePage />
    </Suspense>
  );
}

function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, login } = usePrivy();
  
  const [activeTab, setActiveTab] = useState<'explore' | 'leaderboard'>('explore');
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("score_desc");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'leaderboard') setActiveTab('leaderboard');
    else setActiveTab('explore');
    
    const query = searchParams.get('q');
    if (query) setSearch(query);
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/v1/stats").then(r => r.ok ? r.json() : null).then(data => data && setStats(data));
    fetch("/api/v1/explore/recent").then(r => r.ok ? r.json() : null).then(data => data?.recent && setRecentReviews(data.recent));
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/explore");
      const data = await res.json();
      if (data.projects) {
        const mapped: ExploreItem[] = data.projects.map((p: any) => ({
          id: p.id,
          address: p.address,
          slug: p.slug || p.name.toLowerCase().replace(/\s+/g, '-'),
          name: p.name,
          category: p.category,
          chain: p.chain,
          trustScore: p.trustScore,
          riskLevel: p.trustScore >= 7.0 ? "LOW" : p.trustScore >= 4.0 ? "MEDIUM" : "HIGH",
          txCount: Math.floor(Math.random() * 5000), 
          reviewCount: p.reviewCount || 0,
          ageLabel: "Active",
          starRating: p.avgRating || 0,
          latestReview: p.description || "No description provided.",
          iconLetter: p.name.charAt(0),
          iconColor: categoryColor(p.category),
          votes: Math.floor(Math.random() * 1000) + 50,
        }));
        setItems(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch explore projects:", err);
    } finally {
      setLoading(false);
    }
  }

  function categoryColor(cat: string) {
    if (cat === 'Agent') return '#7C3AED';
    if (cat === 'DeFi' || cat === 'DEX') return '#FF007A';
    if (cat === 'Token' || cat === 'Memecoins') return '#627EEA';
    return '#d4a017';
  }

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ExploreItem | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: "", tags: [] });
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    let result = [...items];
    if (category !== "all") {
      const map: Record<string, string[]> = {
        defi: ["DEX", "Lending", "DeFi"],
        memecoins: ["Memecoins"],
        agents: ["Agent"],
      };
      const allowed = map[category] || [];
      result = result.filter((item) => allowed.includes(item.category));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.address.toLowerCase().includes(q) || 
        item.category.toLowerCase().includes(q)
      );
    }
    
    if (activeTab === 'leaderboard') {
      result.sort((a, b) => (b.votes || 0) - (a.votes || 0));
    } else {
      switch (sortBy) {
        case "score_desc": result.sort((a, b) => b.trustScore - a.trustScore); break;
        case "most_reviewed": result.sort((a, b) => b.reviewCount - a.reviewCount); break;
        case "trending": result.sort((a, b) => b.txCount - a.txCount); break;
      }
    }
    return result;
  }, [category, search, sortBy, items, activeTab]);

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && filtered.length === 0 && isAddress(search)) {
      router.push(`/agent/${search}`);
    }
  }

  async function submitReview() {
    if (!reviewTarget || reviewForm.rating === 0 || !authenticated) return;
    setSubmitting(true);
    try {
      await fetch("/api/v1/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: reviewTarget.address, rating: reviewForm.rating, comment: reviewForm.comment, tags: reviewForm.tags }),
      });
      setReviewOpen(false);
      fetchProjects();
    } catch {}
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-[#030303] text-txt-primary">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6">
        
        <div className="flex flex-col gap-4">
          
          <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-1 flex gap-1 mb-2">
            <button 
              onClick={() => { setActiveTab('explore'); router.push('/explore'); }}
              className={`flex-1 py-2 rounded text-xs font-bold font-mono uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'explore' ? 'bg-[#272729] text-gold' : 'text-txt-muted hover:bg-[#272729]'}`}
            >
              <TrendingUp className="w-4 h-4" /> Hot Agents
            </button>
            <button 
              onClick={() => { setActiveTab('leaderboard'); router.push('/explore?tab=leaderboard'); }}
              className={`flex-1 py-2 rounded text-xs font-bold font-mono uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'leaderboard' ? 'bg-[#272729] text-gold' : 'text-txt-muted hover:bg-[#272729]'}`}
            >
              <Trophy className="w-4 h-4" /> Leaderboard
            </button>
          </div>

          <div className="bg-[#1a1a1b] border border-[#343536] rounded-md px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {["all", "agents", "memecoins", "defi"].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider font-mono border transition-all ${category === cat ? 'bg-gold/10 border-gold text-gold' : 'border-transparent text-txt-muted hover:bg-[#272729]'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && search && (
            <div className="bg-[#1a1a1b] border border-[#343536] rounded-md p-12 flex flex-col items-center gap-4 text-center">
              <Scan className="w-12 h-12 text-gold opacity-50" />
              <p className="font-bold text-lg font-mono uppercase">Unmapped Hub</p>
              <p className="text-sm text-txt-secondary">"{search}" hasn't joined the ranking yet.</p>
              {isAddress(search) && (
                <button onClick={() => router.push(`/agent/${search}`)} className="px-6 py-2.5 bg-gold text-bg-primary rounded font-bold text-xs font-mono uppercase">
                  Scan & Register
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filtered.map((item, idx) => (
              <div key={item.id} className="bg-[#1a1a1b] border border-[#343536] hover:border-[#818384] rounded-md flex overflow-hidden group transition-all shadow-sm">
                <div className="w-10 bg-[#151516] flex flex-col items-center py-2 gap-1 border-r border-[#343536]">
                  <button className="p-1 hover:bg-[#272729] rounded text-[#818384] hover:text-[#ff4500]">
                    <ArrowBigUp className="w-6 h-6" />
                  </button>
                  <span className="text-[11px] font-bold text-[#d7dadc]">{activeTab === 'leaderboard' ? `#${idx+1}` : formatNum(item.votes || 0)}</span>
                  <button className="p-1 hover:bg-[#272729] rounded text-[#818384] hover:text-[#7193ff]">
                    <ArrowDown className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: item.iconColor }}>
                      {item.iconLetter}
                    </div>
                    <span className="text-[11px] font-bold text-[#d7dadc]">m/{item.category.toLowerCase()}</span>
                    <span className="text-[11px] text-[#818384]">· {item.chain}</span>
                  </div>

                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <Link href={`/agent/${item.address}`} className="text-lg font-medium text-[#d7dadc] hover:underline block mb-1">
                        {item.name}
                      </Link>
                      <p className="text-sm text-[#818384] line-clamp-2 leading-snug">
                        {item.latestReview}
                      </p>
                    </div>
                    <div className={`shrink-0 flex flex-col items-center justify-center p-3 rounded-md border ${scoreBg(item.trustScore)}`}>
                      <span className={`text-xl font-bold font-mono ${scoreColor(item.trustScore)}`}>{item.trustScore.toFixed(1)}</span>
                      <span className="text-[8px] font-bold text-txt-muted uppercase tracking-tighter">Trust Score</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <Link href={`/agent/${item.address}`} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#272729] rounded text-[#818384] text-xs font-bold transition-all uppercase font-mono tracking-tighter">
                      <MessageSquare className="w-4 h-4" /> {item.reviewCount} Reports
                    </Link>
                    <button onClick={() => { setReviewTarget(item); setReviewOpen(true); }} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-[#272729] rounded text-[#818384] text-xs font-bold transition-all uppercase font-mono tracking-tighter">
                      <Send className="w-4 h-4" /> Share Opinion
                    </button>
                    <div className="flex-1" />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${riskBadge(item.riskLevel)}`}>
                      {item.riskLevel} Risk
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {reviewOpen && reviewTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#030303]/90" onClick={() => setReviewOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#1a1a1b] border border-[#343536] rounded-md shadow-2xl">
            <div className="px-4 py-3 border-b border-[#343536] flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#d7dadc] uppercase font-mono tracking-widest">Create Opinion for {reviewTarget.name}</h3>
              <button onClick={() => setReviewOpen(false)} className="text-[#818384] hover:text-[#d7dadc]"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <div className="flex gap-3 justify-center bg-[#272729] p-4 rounded-md border border-[#343536]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setReviewForm(p => ({ ...p, rating: star }))} className={`w-12 h-12 rounded flex items-center justify-center text-2xl transition-all ${reviewForm.rating >= star ? "text-gold scale-110" : "text-[#343536] hover:text-[#818384]"}`}>★</button>
                ))}
              </div>
              <textarea 
                value={reviewForm.comment} 
                onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))} 
                placeholder="Share your technical or social analysis..." 
                rows={6} 
                className="w-full p-4 bg-[#272729] border border-[#343536] rounded text-sm text-[#d7dadc] outline-none focus:border-[#d7dadc] resize-none" 
              />
              <div className="flex justify-end">
                <button onClick={submitReview} disabled={submitting || reviewForm.rating === 0} className="px-10 py-2 bg-gold text-black rounded-full font-bold text-xs uppercase tracking-widest disabled:opacity-50 transition-all hover:bg-white">
                  {submitting ? "Posting..." : "Post Opinion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Shield,
  ArrowUpDown,
  MessageSquare,
  Clock,
  Star,
  BarChart3,
} from "lucide-react";
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

interface RecentReview {
  id: string;
  projectName: string;
  projectSlug: string;
  rating: number;
  comment?: string;
  createdAt: string;
  reviewer: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getScoreColor(score: number) {
  if (score >= 7.0) return "text-[#22C55E]";
  if (score >= 4.0) return "text-[#F59E0B]";
  return "text-[#EF4444]";
}

function getRiskBadgeStyle(level: string) {
  switch (level) {
    case "LOW":
      return "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30";
    case "MEDIUM":
      return "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30";
    case "HIGH":
    case "CRITICAL":
      return "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30";
    default:
      return "bg-[#666666]/10 text-[#666666] border-[#666666]/30";
  }
}

function getChainDot(chain: string) {
  switch (chain?.toLowerCase()) {
    case "base":
      return "bg-[#0052FF]";
    case "ethereum":
    case "eth":
      return "bg-purple-500";
    default:
      return "bg-[#666666]";
  }
}

function categoryColor(cat: string) {
  if (cat === "Agent") return "#0052FF";
  if (cat === "DeFi" || cat === "DEX") return "#7C3AED";
  if (cat === "Lending") return "#0EA5E9";
  return "#666666";
}

function truncateDesc(desc: string, maxLen = 50) {
  if (desc.length <= maxLen) return desc;
  return desc.slice(0, maxLen).trim() + "...";
}

function truncateAddress(addr: string) {
  if (!addr) return "anon";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ============================================================================
// MOCK RECENT REVIEWS (fallback if API unavailable)
// ============================================================================

const MOCK_REVIEWS: RecentReview[] = [
  {
    id: "1",
    projectName: "Virtuals Protocol",
    projectSlug: "virtuals-protocol",
    rating: 5,
    comment: "Solid agent framework, well-audited contracts",
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    reviewer: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  },
  {
    id: "2",
    projectName: "aixbt",
    projectSlug: "aixbt",
    rating: 4,
    comment: "Good alpha signals, some false positives",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    reviewer: "0x8ba1f109551bD432803012645Ac136ddd64DBA72",
  },
  {
    id: "3",
    projectName: "Luna",
    projectSlug: "luna",
    rating: 3,
    comment: "Entertaining but limited utility",
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    reviewer: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
  },
  {
    id: "4",
    projectName: "Aave",
    projectSlug: "aave",
    rating: 5,
    comment: "Battle-tested DeFi, trust maximized",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    reviewer: "0xbDA5747bFD65F08deb54cb465eB87D40e51B197E",
  },
  {
    id: "5",
    projectName: "Uniswap",
    projectSlug: "uniswap",
    rating: 5,
    comment: "The OG DEX, flawless execution",
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    reviewer: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
  },
];

// ============================================================================
// WRAPPER
// ============================================================================

export default function ExplorePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Shield className="w-8 h-8 text-[#0052FF] animate-pulse" />
            <span className="text-xs font-mono text-[#666666] uppercase tracking-widest">
              INITIALIZING...
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
// MAIN
// ============================================================================

function ExplorePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"explore" | "leaderboard">("explore");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "most_reviewed">("score_desc");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>(MOCK_REVIEWS);

  useEffect(() => {
    const tab = searchParams.get("tab");
    setActiveTab(tab === "leaderboard" ? "leaderboard" : "explore");
    const q = searchParams.get("q");
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    fetchProjects();
    fetchRecentReviews();
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
          slug: p.slug || p.name.toLowerCase().replace(/\s+/g, "-"),
          name: p.name,
          category: p.category,
          chain: p.chain,
          trustScore: p.trustScore,
          riskLevel:
            p.trustScore >= 7.0 ? "LOW" : p.trustScore >= 4.0 ? "MEDIUM" : "HIGH",
          txCount: 0,
          reviewCount: p.reviewCount || 0,
          ageLabel: "Active",
          starRating: p.avgRating || 0,
          description: p.description || "No description provided.",
          iconLetter: p.name.charAt(0),
          iconColor: categoryColor(p.category),
        }));
        setItems(mapped);
      }
    } catch (err) {
      console.error("Failed to fetch explore projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecentReviews() {
    try {
      const res = await fetch("/api/v1/reviews/recent");
      if (res.ok) {
        const data = await res.json();
        if (data.reviews && data.reviews.length > 0) {
          setRecentReviews(data.reviews.slice(0, 5));
        }
      }
    } catch {
      // Use mock data as fallback
    }
  }

  const filtered = useMemo(() => {
    let result = [...items];

    if (category !== "all") {
      const catMap: Record<string, string[]> = {
        defi: ["DEX", "Lending", "DeFi"],
        agents: ["Agent"],
      };
      const allowed = catMap[category] || [];
      result = result.filter((item) => allowed.includes(item.category));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.address.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "score_desc":
        result.sort((a, b) => b.trustScore - a.trustScore);
        break;
      case "score_asc":
        result.sort((a, b) => a.trustScore - b.trustScore);
        break;
      case "most_reviewed":
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
    }

    if (activeTab === "leaderboard") {
      result = result.sort((a, b) => b.trustScore - a.trustScore);
    }

    return result;
  }, [category, search, sortBy, items, activeTab]);

  const toggleSort = () => {
    if (sortBy === "score_desc") setSortBy("score_asc");
    else if (sortBy === "score_asc") setSortBy("most_reviewed");
    else setSortBy("score_desc");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Terminal Header */}
        <div className="mb-6">
          <h1 className="text-sm font-mono text-[#666666] uppercase tracking-widest mb-1">
            // TRUST EXPLORER — {items.length} PROTOCOLS
          </h1>
          <div className="h-px bg-gradient-to-r from-[#0052FF]/50 via-[#1F1F1F] to-transparent" />
        </div>

        {/* Two-Column Layout */}
        <div className="flex gap-6">
          {/* LEFT: Main List (70%) */}
          <div className="flex-1 min-w-0" style={{ flex: "7" }}>
            {/* Tab Bar */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex gap-1">
                {[
                  { id: "explore", label: "EXPLORE", icon: TrendingUp },
                  { id: "leaderboard", label: "LEADERBOARD", icon: Trophy },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      router.push(
                        tab.id === "leaderboard" ? "/explore?tab=leaderboard" : "/explore"
                      );
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-all rounded border ${
                      activeTab === tab.id
                        ? "bg-[#0052FF]/10 border-[#0052FF]/40 text-[#0052FF]"
                        : "border-[#1F1F1F] text-[#666666] hover:border-[#333] hover:text-[#999]"
                    }`}
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                ))}

                {/* Markets Tab */}
                <Link
                  href="/markets"
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-all rounded border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] hover:bg-[#F59E0B]/20"
                >
                  <BarChart3 className="w-3 h-3" />
                  MARKETS
                </Link>
              </div>

              {/* Sort Toggle */}
              <button
                onClick={toggleSort}
                className="ml-auto flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase text-[#666666] hover:text-[#999] transition-colors"
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortBy === "score_desc"
                  ? "HIGH→LOW"
                  : sortBy === "score_asc"
                  ? "LOW→HIGH"
                  : "REVIEWS"}
              </button>
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-3 mb-4">
              {/* Category Pills */}
              <div className="flex gap-1.5">
                {["all", "agents", "defi"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wide rounded border transition-all ${
                      category === cat
                        ? "bg-[#0052FF]/10 border-[#0052FF]/40 text-[#0052FF]"
                        : "border-[#1F1F1F] text-[#666666] hover:border-[#333] hover:text-[#999]"
                    }`}
                  >
                    [{cat === "all" ? "ALL" : cat === "agents" ? "AI AGENTS" : "DEFI"}]
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666666]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="search protocols..."
                  className="w-full bg-[#111111] border border-[#1F1F1F] rounded px-3 py-1.5 pl-9 text-xs font-mono text-[#E5E5E5] placeholder-[#444] outline-none focus:border-[#0052FF]/40 transition-colors"
                />
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[180px_1fr_120px_100px_60px] gap-4 px-4 py-2 text-[9px] font-mono uppercase text-[#666666] tracking-wider border-b border-[#1F1F1F] mb-2">
              <span>PROTOCOL</span>
              <span>DESCRIPTION</span>
              <span className="text-right">REVIEWS</span>
              <span className="text-center">RISK</span>
              <span className="text-right">TRUST</span>
            </div>

            {/* Loading Skeleton */}
            {loading && (
              <div className="flex flex-col gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="h-[72px] bg-[#111111] border border-[#1F1F1F] rounded-lg animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="w-14 h-14 rounded-lg bg-[#111111] border border-[#1F1F1F] flex items-center justify-center">
                  <Scan className="w-6 h-6 text-[#666666]" />
                </div>
                <div>
                  <p className="font-mono text-sm text-[#E5E5E5] mb-1">
                    {search ? `NO MATCHES FOR "${search.toUpperCase()}"` : "NO PROTOCOLS FOUND"}
                  </p>
                  <p className="text-xs font-mono text-[#666666]">
                    {isAddress(search ?? "")
                      ? "// address not indexed"
                      : "// adjust filters or search"}
                  </p>
                </div>
              </div>
            )}

            {/* Project List */}
            {!loading && filtered.length > 0 && (
              <div className="flex flex-col gap-1">
                {filtered.map((item, idx) => (
                  <Link
                    key={item.id}
                    href={`/agent/${item.slug}`}
                    className="group grid grid-cols-[180px_1fr_120px_100px_60px] gap-4 items-center px-4 py-3 bg-[#111111] border border-[#1F1F1F] rounded-lg transition-all duration-200 hover:border-[#0052FF]/50 hover:shadow-[0_0_20px_rgba(0,82,255,0.1)]"
                    style={{ minHeight: "72px" }}
                  >
                    {/* Protocol */}
                    <div className="flex items-center gap-3 min-w-0">
                      {activeTab === "leaderboard" && (
                        <span className="text-xs font-bold font-mono text-[#666666] w-5">
                          #{idx + 1}
                        </span>
                      )}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0"
                        style={{
                          backgroundColor: item.iconColor + "22",
                          color: item.iconColor,
                          border: `1px solid ${item.iconColor}44`,
                        }}
                      >
                        {item.iconLetter}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <span className="text-sm font-semibold text-[#E5E5E5] truncate group-hover:text-[#0052FF] transition-colors">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${getChainDot(item.chain)}`} />
                          <span className="text-[9px] font-mono text-[#666666] uppercase">
                            {item.chain || "?"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs font-mono text-[#666666] truncate">
                      {truncateDesc(item.description)}
                    </p>

                    {/* Reviews */}
                    <span className="text-xs font-mono text-[#666666] text-right">
                      {item.reviewCount} reviews
                    </span>

                    {/* Risk Badge */}
                    <div className="flex justify-center">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wide rounded border ${getRiskBadgeStyle(item.riskLevel)}`}
                      >
                        {item.riskLevel}
                      </span>
                    </div>

                    {/* Trust Score */}
                    <div className="flex flex-col items-end">
                      <span
                        className={`text-lg font-bold font-mono leading-none ${getScoreColor(item.trustScore)}`}
                      >
                        {item.trustScore.toFixed(1)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Activity Panel (30%) */}
          <div className="w-80 shrink-0 hidden lg:block">
            <div className="sticky top-6">
              {/* Activity Panel Header */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-mono text-[#666666] uppercase tracking-widest">
                  // RECENT REVIEWS
                </span>
                <div className="flex-1 h-px bg-[#1F1F1F]" />
              </div>

              {/* Reviews Feed */}
              <div className="flex flex-col gap-2">
                {recentReviews.map((review) => (
                  <Link
                    key={review.id}
                    href={`/agent/${review.projectSlug}`}
                    className="group bg-[#111111] border border-[#1F1F1F] rounded-lg p-3 transition-all hover:border-[#333] hover:bg-[#151515]"
                  >
                    {/* Top row: project + time */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#E5E5E5] group-hover:text-[#0052FF] transition-colors">
                        {review.projectName}
                      </span>
                      <span className="text-[9px] font-mono text-[#666666] flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {timeAgo(review.createdAt)}
                      </span>
                    </div>

                    {/* Rating stars */}
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${
                            star <= review.rating
                              ? "text-[#F59E0B] fill-[#F59E0B]"
                              : "text-[#333]"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Comment */}
                    {review.comment && (
                      <p className="text-[10px] font-mono text-[#666666] line-clamp-2 mb-2">
                        "{review.comment}"
                      </p>
                    )}

                    {/* Reviewer */}
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-[#0052FF]/20 flex items-center justify-center">
                        <MessageSquare className="w-2 h-2 text-[#0052FF]" />
                      </div>
                      <span className="text-[9px] font-mono text-[#666666]">
                        {truncateAddress(review.reviewer)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Footer link */}
              <div className="mt-4 pt-4 border-t border-[#1F1F1F]">
                <Link
                  href="/reviews"
                  className="text-[10px] font-mono text-[#666666] hover:text-[#0052FF] transition-colors uppercase tracking-wide"
                >
                  VIEW ALL REVIEWS →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

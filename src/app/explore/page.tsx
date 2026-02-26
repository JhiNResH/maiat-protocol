"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

// ============================================================================
// TYPES
// ============================================================================

interface ExploreItem {
  id: string;
  address: string;
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
  /** Per docs/trust-score-spec.md §4 — seed scores are display-only */
  dataSource: "onchain" | "cre" | "seed" | "unknown";
}

interface ReviewFormData {
  rating: number;
  comment: string;
  tags: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CATEGORIES = [
  { id: "all",           label: "All" },
  { id: "defi",          label: "DeFi" },
  { id: "tokens",        label: "Tokens" },
  { id: "agent-tokens",  label: "Agent Tokens" },
  { id: "agent-wallets", label: "Agent Wallets" },
  { id: "protocols",     label: "Protocols" },
];

const CHAINS = [
  { id: "all",      label: "All Chains" },
  { id: "Base",     label: "Base" },
  { id: "Ethereum", label: "Ethereum" },
  { id: "BNB",      label: "BNB" },
];

const SORT_OPTIONS = [
  { id: "score_desc", label: "Score High→Low" },
  { id: "most_reviewed", label: "Most Reviewed" },
  { id: "trending", label: "Trending" },
];

const REVIEW_TAGS = [
  "Trustworthy",
  "Suspicious",
  "Rug Risk",
  "Well Audited",
  "Innovative",
  "High Yield",
  "Established",
];

// ============================================================================
// SEED DATA (will be replaced by API calls)
// ============================================================================

const SEED_ITEMS: ExploreItem[] = [
  {
    id: "1",
    address: "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24",
    name: "Uniswap V3 Router",
    category: "DEX",
    chain: "Base",
    trustScore: 8.5,
    riskLevel: "LOW",
    txCount: 245891,
    reviewCount: 47,
    ageLabel: "4y",
    starRating: 4.7,
    latestReview: "Battle-tested protocol with consistent performance.",
    iconLetter: "U",
    iconColor: "#FF007A",
    dataSource: "seed" as const,
  },
  {
    id: "2",
    address: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    name: "Aave V3 Pool",
    category: "Lending",
    chain: "Base",
    trustScore: 9.2,
    riskLevel: "LOW",
    txCount: 189432,
    reviewCount: 38,
    ageLabel: "3y",
    starRating: 4.5,
    latestReview: "Solid lending protocol, governance is strong.",
    iconLetter: "A",
    iconColor: "#B6509E",
    dataSource: "seed" as const,
  },
  {
    id: "3",
    address: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    name: "Aerodrome Router",
    category: "DEX",
    chain: "Base",
    trustScore: 7.8,
    riskLevel: "LOW",
    txCount: 312847,
    reviewCount: 29,
    ageLabel: "2y",
    starRating: 4.2,
    latestReview: "Best DEX on Base, great liquidity.",
    iconLetter: "Ae",
    iconColor: "#0052FF",
    dataSource: "seed" as const,
  },
  {
    id: "4",
    address: "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B",
    name: "Stargate Router",
    category: "Bridge",
    chain: "Base",
    trustScore: 7.9,
    riskLevel: "LOW",
    txCount: 98234,
    reviewCount: 15,
    ageLabel: "2y",
    starRating: 3.8,
    latestReview: "Works well for cross-chain, decent fees.",
    iconLetter: "S",
    iconColor: "#6366F1",
    dataSource: "seed" as const,
  },
  {
    id: "5",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    name: "USDC",
    category: "Stablecoin",
    chain: "Base",
    trustScore: 9.2,
    riskLevel: "LOW",
    txCount: 1567890,
    reviewCount: 42,
    ageLabel: "5y",
    starRating: 4.6,
    latestReview: "Gold standard stablecoin, fully backed.",
    iconLetter: "U",
    iconColor: "#2775CA",
    dataSource: "seed" as const,
  },
  {
    id: "6",
    address: "0xb125E6687d4313864e53df431d5425969c15Eb2F",
    name: "Compound V3",
    category: "Lending",
    chain: "Base",
    trustScore: 8.8,
    riskLevel: "LOW",
    txCount: 134567,
    reviewCount: 31,
    ageLabel: "4y",
    starRating: 4.3,
    latestReview: "Reliable but UI could use improvement.",
    iconLetter: "C",
    iconColor: "#00D395",
    dataSource: "seed" as const,
  },
  {
    id: "7",
    address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    name: "Morpho Blue",
    category: "Lending",
    chain: "Base",
    trustScore: 8.2,
    riskLevel: "LOW",
    txCount: 87654,
    reviewCount: 12,
    ageLabel: "1y",
    starRating: 4.1,
    latestReview: "Innovative lending design, growing fast.",
    iconLetter: "M",
    iconColor: "#1A1B23",
    dataSource: "seed" as const,
  },
  {
    id: "8",
    address: "0x4200000000000000000000000000000000000006",
    name: "WETH",
    category: "Token",
    chain: "Base",
    trustScore: 9.2,
    riskLevel: "LOW",
    txCount: 2345678,
    reviewCount: 55,
    ageLabel: "5y+",
    starRating: 4.8,
    latestReview: "Canonical wrapped ETH, no concerns.",
    iconLetter: "W",
    iconColor: "#627EEA",
    dataSource: "seed" as const,
  },
  // Agents — real contract addresses on Base
  {
    id: "9",
    address: "0x44ff8620b8cA30902395A7bD3F2407e1A091BF73",
    name: "Virtuals Protocol",
    category: "Agent Token",
    chain: "Base",
    trustScore: 7.2,
    riskLevel: "LOW",
    txCount: 156000,
    reviewCount: 18,
    ageLabel: "1y",
    starRating: 3.9,
    latestReview: "Leading AI agent launchpad on Base. Strong community.",
    iconLetter: "V",
    iconColor: "#7C3AED",
    dataSource: "seed" as const,
  },
  {
    id: "10",
    address: "0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825",
    name: "AIXBT by Virtuals",
    category: "Agent Token",
    chain: "Base",
    trustScore: 6.2,
    riskLevel: "MEDIUM",
    txCount: 287000,
    reviewCount: 11,
    ageLabel: "8mo",
    starRating: 3.7,
    latestReview: "Best CT alpha agent. Tracks 400+ KOLs. Token volatile.",
    iconLetter: "AI",
    iconColor: "#F97316",
    dataSource: "seed" as const,
  },
  {
    id: "11",
    address: "0x55cd6469f597452b5a7536e2cd98fde4c1247ee4",
    name: "Luna by Virtuals",
    category: "Agent Token",
    chain: "Base",
    trustScore: 5.1,
    riskLevel: "MEDIUM",
    txCount: 94000,
    reviewCount: 8,
    ageLabel: "6mo",
    starRating: 3.2,
    latestReview: "First IAO agent on Virtuals. Viral TikTok presence.",
    iconLetter: "L",
    iconColor: "#EC4899",
    dataSource: "seed" as const,
  },
  {
    id: "15",
    address: "0x731814e491571a2e9ee3c5b1f7f3b962ee8f4870",
    name: "VaderAI by Virtuals",
    category: "Agent Token",
    chain: "Base",
    trustScore: 5.6,
    riskLevel: "MEDIUM",
    txCount: 62000,
    reviewCount: 6,
    ageLabel: "7mo",
    starRating: 3.5,
    latestReview: "DeFi-focused agent with DAO governance. Growing.",
    iconLetter: "VD",
    iconColor: "#6D28D9",
    dataSource: "seed" as const,
  },
  {
    id: "16",
    address: "0x3e466dad6695879fd783e2bfcb98e16ce15a3caf",
    name: "Freysa AI",
    category: "Agent Token",
    chain: "Base",
    trustScore: 6.8,
    riskLevel: "LOW",
    txCount: 41000,
    reviewCount: 9,
    ageLabel: "5mo",
    starRating: 3.9,
    latestReview: "Adversarial AI game experiment. Unique security model.",
    iconLetter: "FR",
    iconColor: "#059669",
    dataSource: "seed" as const,
  },
  {
    id: "17",
    address: "0x1185cb5122edad199bdbc0cbd7a0457e448f23c7",
    name: "Sekoia by Virtuals",
    category: "Agent Token",
    chain: "Base",
    trustScore: 4.8,
    riskLevel: "MEDIUM",
    txCount: 38000,
    reviewCount: 5,
    ageLabel: "4mo",
    starRating: 3.1,
    latestReview: "Early stage. Community driven. Watch for utility.",
    iconLetter: "SK",
    iconColor: "#0891B2",
    dataSource: "seed" as const,
  },
  {
    id: "12",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    name: "DAI",
    category: "Stablecoin",
    chain: "Base",
    trustScore: 8.9,
    riskLevel: "LOW",
    txCount: 890000,
    reviewCount: 35,
    ageLabel: "5y+",
    starRating: 4.5,
    latestReview: "Decentralized stablecoin pioneer.",
    iconLetter: "D",
    iconColor: "#F5AC37",
    dataSource: "seed" as const,
  },
  // Protocols
  {
    id: "13",
    address: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    name: "Chainlink ETH/USD",
    category: "Oracle",
    chain: "Base",
    trustScore: 9.1,
    riskLevel: "LOW",
    txCount: 1200000,
    reviewCount: 28,
    ageLabel: "4y",
    starRating: 4.7,
    latestReview: "The oracle standard, extremely reliable.",
    iconLetter: "C",
    iconColor: "#375BD2",
    dataSource: "seed" as const,
  },
  {
    id: "14",
    address: "0x4200000000000000000000000000000000000010",
    name: "Base Bridge",
    category: "Bridge",
    chain: "Base",
    trustScore: 8.7,
    riskLevel: "LOW",
    txCount: 3400000,
    reviewCount: 22,
    ageLabel: "2y",
    starRating: 4.3,
    latestReview: "Official L2 bridge, trust Coinbase infra.",
    iconLetter: "B",
    iconColor: "#0052FF",
    dataSource: "seed" as const,
  },

  // ── Ethereum Mainnet ─────────────────────────────────────────────────────
  {
    id: "eth-1",
    address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    name: "Uniswap V3 Router",
    category: "DEX",
    chain: "Ethereum",
    trustScore: 9.0,
    riskLevel: "LOW",
    txCount: 4800000,
    reviewCount: 112,
    ageLabel: "4y",
    starRating: 4.9,
    latestReview: "The most battle-tested DEX router in existence.",
    iconLetter: "U",
    iconColor: "#FF007A",
    dataSource: "seed" as const,
  },
  {
    id: "eth-2",
    address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    name: "Aave V3 Pool",
    category: "Lending",
    chain: "Ethereum",
    trustScore: 9.3,
    riskLevel: "LOW",
    txCount: 2900000,
    reviewCount: 89,
    ageLabel: "5y",
    starRating: 4.8,
    latestReview: "Industry standard for DeFi lending. Excellent risk controls.",
    iconLetter: "A",
    iconColor: "#B6509E",
    dataSource: "seed" as const,
  },
  {
    id: "eth-3",
    address: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    name: "Lido stETH",
    category: "Yield",
    chain: "Ethereum",
    trustScore: 8.8,
    riskLevel: "LOW",
    txCount: 1650000,
    reviewCount: 67,
    ageLabel: "4y",
    starRating: 4.6,
    latestReview: "Largest liquid staking protocol. Multiple audits.",
    iconLetter: "Li",
    iconColor: "#00A3FF",
    dataSource: "seed" as const,
  },
  {
    id: "eth-4",
    address: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
    name: "Compound V3",
    category: "Lending",
    chain: "Ethereum",
    trustScore: 8.9,
    riskLevel: "LOW",
    txCount: 980000,
    reviewCount: 54,
    ageLabel: "4y",
    starRating: 4.4,
    latestReview: "Reliable lending with conservative risk management.",
    iconLetter: "C",
    iconColor: "#00D395",
    dataSource: "seed" as const,
  },
  {
    id: "eth-5",
    address: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    name: "Chainlink ETH/USD",
    category: "Oracle",
    chain: "Ethereum",
    trustScore: 9.4,
    riskLevel: "LOW",
    txCount: 5200000,
    reviewCount: 73,
    ageLabel: "5y",
    starRating: 4.9,
    latestReview: "The gold standard oracle. Never goes down.",
    iconLetter: "C",
    iconColor: "#375BD2",
    dataSource: "seed" as const,
  },
  {
    id: "eth-6",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    name: "USDT (Tether)",
    category: "Stablecoin",
    chain: "Ethereum",
    trustScore: 8.5,
    riskLevel: "LOW",
    txCount: 12000000,
    reviewCount: 145,
    ageLabel: "6y",
    starRating: 4.0,
    latestReview: "Most used stablecoin. Centralized but widespread trust.",
    iconLetter: "T",
    iconColor: "#26A17B",
    dataSource: "seed" as const,
  },
  {
    id: "eth-7",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    name: "WBTC",
    category: "Token",
    chain: "Ethereum",
    trustScore: 8.7,
    riskLevel: "LOW",
    txCount: 890000,
    reviewCount: 48,
    ageLabel: "5y",
    starRating: 4.5,
    latestReview: "Canonical wrapped Bitcoin on Ethereum.",
    iconLetter: "W",
    iconColor: "#F7931A",
    dataSource: "seed" as const,
  },

  // ── BNB Chain ────────────────────────────────────────────────────────────
  {
    id: "bnb-1",
    address: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
    name: "PancakeSwap V3",
    category: "DEX",
    chain: "BNB",
    trustScore: 8.2,
    riskLevel: "LOW",
    txCount: 6700000,
    reviewCount: 91,
    ageLabel: "4y",
    starRating: 4.5,
    latestReview: "Dominant DEX on BSC. High volume, good liquidity.",
    iconLetter: "P",
    iconColor: "#1FC7D4",
    dataSource: "seed" as const,
  },
  {
    id: "bnb-2",
    address: "0xfD36E2c2a6789Db23113685031d7F16329158384",
    name: "Venus Comptroller",
    category: "Lending",
    chain: "BNB",
    trustScore: 7.8,
    riskLevel: "LOW",
    txCount: 1200000,
    reviewCount: 43,
    ageLabel: "3y",
    starRating: 4.1,
    latestReview: "BSC's leading lending protocol. Has had issues but recovered.",
    iconLetter: "V",
    iconColor: "#9C4221",
    dataSource: "seed" as const,
  },
  {
    id: "bnb-3",
    address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
    name: "CAKE",
    category: "Token",
    chain: "BNB",
    trustScore: 7.5,
    riskLevel: "LOW",
    txCount: 3400000,
    reviewCount: 67,
    ageLabel: "4y",
    starRating: 3.9,
    latestReview: "PancakeSwap governance token. High emission historically.",
    iconLetter: "CK",
    iconColor: "#1FC7D4",
    dataSource: "seed" as const,
  },
  {
    id: "bnb-4",
    address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
    name: "BTCB",
    category: "Token",
    chain: "BNB",
    trustScore: 8.5,
    riskLevel: "LOW",
    txCount: 780000,
    reviewCount: 29,
    ageLabel: "4y",
    starRating: 4.4,
    latestReview: "BSC's wrapped BTC. Lower fees than WBTC.",
    iconLetter: "BT",
    iconColor: "#F7931A",
    dataSource: "seed" as const,
  },
  {
    id: "bnb-5",
    address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    name: "WBNB",
    category: "Token",
    chain: "BNB",
    trustScore: 9.0,
    riskLevel: "LOW",
    txCount: 9800000,
    reviewCount: 82,
    ageLabel: "4y",
    starRating: 4.7,
    latestReview: "Native wrapped BNB. Canonical and widely used.",
    iconLetter: "WB",
    iconColor: "#F3BA2F",
    dataSource: "seed" as const,
  },
  {
    id: "bnb-6",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    name: "USDC (BEP-20)",
    category: "Stablecoin",
    chain: "BNB",
    trustScore: 9.0,
    riskLevel: "LOW",
    txCount: 4500000,
    reviewCount: 56,
    ageLabel: "3y",
    starRating: 4.6,
    latestReview: "Circle's USDC on BSC. Fully backed.",
    iconLetter: "U",
    iconColor: "#2775CA",
    dataSource: "seed" as const,
  },
];

const TOP_MOVERS = [
  {
    name: "AIXBT",
    address: "0x4f9f...825",
    change: 18,
    direction: "up" as const,
  },
  {
    name: "Freysa AI",
    address: "0x3e46...caf",
    change: 34,
    direction: "up" as const,
  },
  {
    name: "Sekoia",
    address: "0x1185...3c7",
    change: -15,
    direction: "down" as const,
  },
];

const NEEDS_REVIEW = [
  {
    name: "Base Bridge",
    address: "0x4200000000000000000000000000000000000010",
    score: 8.7,
  },
  {
    name: "DAI",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    score: 8.9,
  },
  {
    name: "Chainlink Feed",
    address: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    score: 9.1,
  },
];

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
    case "LOW":
      return "bg-green-500/15 text-green-400";
    case "MEDIUM":
      return "bg-yellow-500/15 text-yellow-400";
    case "HIGH":
      return "bg-orange-500/15 text-orange-400";
    case "CRITICAL":
      return "bg-red-500/15 text-red-400";
    default:
      return "bg-zinc-500/15 text-zinc-400";
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
        <span
          key={i}
          className={`text-xs ${i <= Math.round(rating) ? "text-gold" : "text-zinc-600"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ============================================================================
// MAIN
// ============================================================================

export default function ExplorePage() {
  const { authenticated, login } = usePrivy();
  const [category, setCategory] = useState("all");
  const [selectedChain, setSelectedChain] = useState("all");
  const [sortBy, setSortBy] = useState("score_desc");
  const [search, setSearch] = useState("");
  const [showSort, setShowSort] = useState(false);

  // Live items (starts from seed, updated by API)
  const [items, setItems] = useState<ExploreItem[]>(SEED_ITEMS);

  // Real stats from DB
  const [stats, setStats] = useState<{
    addressesScored: number;
    totalReviews: number;
    contributors: number;
  } | null>(null);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/v1/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {});

    fetch("/api/v1/explore/recent")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.recent) setRecentReviews(data.recent);
      })
      .catch(() => {});
  }, []);

  // Fetch live scores + review counts in background
  useEffect(() => {
    let cancelled = false;

    async function fetchLiveData() {
      const updated = await Promise.all(
        SEED_ITEMS.map(async (item) => {
          try {
            const chainParam = item.chain === "Ethereum" ? "eth" : item.chain === "BNB" ? "bnb" : "base";
            const [scoreRes, reviewRes] = await Promise.all([
              fetch(`/api/v1/score/${item.address}?chain=${chainParam}`),
              fetch(`/api/v1/review?address=${item.address}`),
            ]);
            const scoreData = scoreRes.ok ? await scoreRes.json() : null;
            const reviewData = reviewRes.ok ? await reviewRes.json() : null;

            return {
              ...item,
              trustScore: scoreData?.score ?? item.trustScore,
              riskLevel: (scoreData?.riskLevel ??
                item.riskLevel) as ExploreItem["riskLevel"],
              txCount:
                scoreData?.details?.txCount ??
                scoreData?.txCount ??
                item.txCount,
              reviewCount: reviewData?.count ?? item.reviewCount,
              starRating: reviewData?.averageRating ?? item.starRating,
              dataSource: (scoreData?.dataSource ??
                item.dataSource) as ExploreItem["dataSource"],
            };
          } catch {
            return item; // keep seed data on error
          }
        }),
      );
      if (!cancelled) setItems(updated);
    }

    fetchLiveData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Review modal
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<ExploreItem | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    rating: 0,
    comment: "",
    tags: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    let result = [...items];

    // Chain filter
    if (selectedChain !== "all") {
      result = result.filter((item) => item.chain === selectedChain);
    }

    if (category !== "all") {
      const map: Record<string, string[]> = {
        defi:          ["DEX", "Lending", "DeFi", "Yield"],
        tokens:        ["Token", "Stablecoin"],
        "agent-tokens":  ["Agent Token"],
        "agent-wallets": ["Agent Wallet"],
        protocols:     ["Oracle", "Bridge", "Infrastructure"],
      };
      const allowed = map[category] || [];
      result = result.filter((item) => allowed.includes(item.category));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.address.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q),
      );
    }

    switch (sortBy) {
      case "score_desc":
        result.sort((a, b) => b.trustScore - a.trustScore);
        break;
      case "most_reviewed":
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case "trending":
        result.sort((a, b) => b.txCount - a.txCount);
        break;
    }

    return result;
  }, [category, selectedChain, search, sortBy, items]);

  function openReview(item: ExploreItem) {
    if (!authenticated) {
      login();
      return;
    }
    setReviewTarget(item);
    setReviewForm({ rating: 0, comment: "", tags: [] });
    setReviewOpen(true);
  }

  async function submitReview() {
    if (!reviewTarget || reviewForm.rating === 0 || !authenticated) return;
    setSubmitting(true);
    try {
      await fetch("/api/v1/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: reviewTarget.address,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          tags: reviewForm.tags,
        }),
      });
      setReviewOpen(false);
    } catch {
      /* ignore for now */
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-bg-primary text-txt-primary">

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
          <p className="text-sm text-txt-muted mt-1">
            Browse trust scores for protocols, tokens, and agents across Base, Ethereum, and BNB
          </p>
        </div>

        {/* Chain filter */}
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedChain(c.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all whitespace-nowrap ${
                selectedChain === c.id
                  ? "bg-[#1a1a1e] text-gold border border-gold/30"
                  : "text-txt-muted hover:text-txt-secondary border border-transparent hover:border-border-subtle"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  category === cat.id
                    ? "bg-gold text-bg-primary font-semibold"
                    : "border border-border-subtle text-txt-secondary hover:border-gold/40"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-9 pr-4 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm text-txt-primary placeholder-txt-muted outline-none focus:border-gold/40 w-[200px]"
                spellCheck={false}
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="flex items-center gap-1.5 px-3 py-2 border border-border-subtle rounded-lg text-xs font-medium text-txt-secondary hover:border-gold/40"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-gold" />
                Sort
              </button>
              {showSort && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowSort(false)}
                  />
                  <div className="absolute right-0 top-11 z-40 w-44 bg-bg-card border border-border-subtle rounded-xl shadow-xl overflow-hidden">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortBy(opt.id);
                          setShowSort(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-xs transition-colors ${
                          sortBy === opt.id
                            ? "bg-gold/10 text-gold font-semibold"
                            : "text-txt-secondary hover:bg-bg-primary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Card Grid */}
          <div className="flex-1 space-y-3">
            <p className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-2">
              {filtered.length} Protocols
            </p>

            {filtered.map((item) => (
              <div
                key={item.id}
                className="bg-bg-card border border-border-subtle rounded-xl p-4 hover:border-gold/30 transition-colors"
              >
                {/* Top Row */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: item.iconColor }}
                  >
                    {item.iconLetter}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-2 py-0.5 rounded-md bg-gold/10 text-gold text-[9px] font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                        item.chain === "Ethereum" ? "bg-[#627EEA]/15 text-[#627EEA]" :
                        item.chain === "BNB"      ? "bg-[#F3BA2F]/15 text-[#F3BA2F]" :
                                                    "bg-[#0052FF]/15 text-[#0052FF]"
                      }`}>
                        {item.chain}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`shrink-0 px-2.5 py-1.5 rounded-xl border ${scoreBg(item.trustScore)} text-center`}
                  >
                    <p
                      className={`text-lg font-bold leading-none ${scoreColor(item.trustScore)}`}
                    >
                      {item.trustScore}
                    </p>
                    <p className="text-[8px] text-txt-muted uppercase tracking-wider mt-0.5">
                      Score
                    </p>
                  </div>
                </div>

                {/* Risk + Stats */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${riskBadge(item.riskLevel)}`}
                  >
                    {item.riskLevel} RISK
                  </span>
                  <p className="text-[10px] text-txt-muted">
                    {formatNum(item.txCount)} tx · {item.reviewCount} reviews ·{" "}
                    {item.ageLabel} old
                  </p>
                </div>

                {/* Community */}
                <div className="border-t border-border-subtle pt-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Stars rating={item.starRating} />
                    <span className="text-[11px] text-txt-muted">
                      {item.starRating.toFixed(1)} ({item.reviewCount})
                    </span>
                  </div>
                  <p className="text-[11px] text-txt-muted italic line-clamp-1 mb-3">
                    "{item.latestReview}"
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openReview(item)}
                      className="flex-1 py-2 rounded-lg border border-gold/40 text-gold text-[11px] font-bold uppercase tracking-wider hover:bg-gold/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Add Review
                    </button>
                    <Link
                      href={`/score/${item.address}`}
                      className="flex-1 py-2 rounded-lg bg-gold/10 text-gold text-[11px] font-bold uppercase tracking-wider hover:bg-gold/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      View Details
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block w-[280px] space-y-4 shrink-0">
            {/* Top Movers */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <h3 className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-gold" />
                Top Movers
              </h3>
              <div className="space-y-2">
                {TOP_MOVERS.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div>
                      <span className="text-xs font-bold">{m.name}</span>
                      <span className="text-[9px] text-txt-muted font-mono ml-1.5">
                        {m.address}
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-bold ${m.direction === "up" ? "text-green-400" : "text-red-400"}`}
                    >
                      {m.direction === "up" ? "+" : ""}
                      {m.change}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recently Reviewed */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <h3 className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gold" />
                Recently Reviewed
              </h3>
              <div className="space-y-2.5">
                {recentReviews.length > 0 ? (
                  recentReviews.map((r, i) => (
                    <div
                      key={i}
                      className="border-b border-border-subtle last:border-0 pb-2 last:pb-0"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold">
                          {r.target}
                        </span>
                        <Stars rating={r.rating} />
                      </div>
                      <p className="text-[10px] text-txt-muted italic line-clamp-1">
                        "{r.snippet}"
                      </p>
                      <p className="text-[9px] text-txt-muted/50 font-mono mt-0.5">
                        by {r.reviewer} · {r.hoursAgo}h ago
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-txt-muted italic">
                    No recent reviews yet.
                  </p>
                )}
              </div>
            </div>

            {/* Needs Review */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-4">
              <h3 className="text-[10px] font-bold tracking-widest text-txt-muted uppercase mb-3 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-yellow-400" />
                Needs Review
              </h3>
              <div className="space-y-2">
                {NEEDS_REVIEW.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5"
                  >
                    <div>
                      <p className="text-xs font-semibold">{item.name}</p>
                      <p className="text-[9px] text-txt-muted">
                        Score: {item.score} · 0 reviews
                      </p>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-[10px] font-bold uppercase tracking-wider hover:bg-gold/10 transition-colors">
                      Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Footer */}
        <div className="mt-8 bg-bg-card border border-border-subtle rounded-xl p-4 flex items-center justify-around text-center">
          <div>
            <p className="text-lg font-bold text-gold">
              {stats ? stats.addressesScored.toLocaleString() : "—"}
            </p>
            <p className="text-[9px] text-txt-muted uppercase tracking-wider">
              Addresses Scored
            </p>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div>
            <p className="text-lg font-bold text-gold">
              {stats ? stats.totalReviews.toLocaleString() : "—"}
            </p>
            <p className="text-[9px] text-txt-muted uppercase tracking-wider">
              Reviews
            </p>
          </div>
          <div className="w-px h-8 bg-border-subtle" />
          <div>
            <p className="text-lg font-bold text-gold">
              {stats ? stats.contributors.toLocaleString() : "—"}
            </p>
            <p className="text-[9px] text-txt-muted uppercase tracking-wider">
              Contributors
            </p>
          </div>
        </div>
      </main>

      {/* Review Modal */}
      {reviewOpen && reviewTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setReviewOpen(false)}
          />
          <div className="relative w-full max-w-md bg-bg-card border border-border-subtle rounded-2xl p-6 mx-4">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: reviewTarget.iconColor }}
                >
                  {reviewTarget.iconLetter}
                </div>
                <div>
                  <h3 className="font-bold">{reviewTarget.name}</h3>
                  <p className="text-[10px] text-txt-muted font-mono">
                    {reviewTarget.address.slice(0, 10)}...
                    {reviewTarget.address.slice(-6)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewOpen(false)}
                className="p-2 hover:bg-bg-primary rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-txt-muted" />
              </button>
            </div>

            {/* Stars */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-txt-muted mb-3">
                Your Rating
              </label>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() =>
                      setReviewForm((prev) => ({ ...prev, rating: star }))
                    }
                    className={`w-10 h-10 rounded-lg text-xl transition-all ${
                      reviewForm.rating >= star
                        ? "bg-gold text-bg-primary scale-105"
                        : "bg-bg-primary text-txt-muted/30 hover:bg-bg-primary/80"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-txt-muted mb-2">
                Your Review
              </label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) =>
                  setReviewForm((prev) => ({
                    ...prev,
                    comment: e.target.value,
                  }))
                }
                placeholder="Share your experience..."
                rows={3}
                className="w-full px-4 py-3 bg-bg-primary border border-border-subtle rounded-xl text-sm text-txt-primary placeholder-txt-muted outline-none focus:border-gold/40 resize-none"
              />
            </div>

            {/* Tags */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-txt-muted mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5">
                {REVIEW_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setReviewForm((prev) => ({
                        ...prev,
                        tags: prev.tags.includes(tag)
                          ? prev.tags.filter((t) => t !== tag)
                          : [...prev.tags, tag],
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                      reviewForm.tags.includes(tag)
                        ? "bg-gold/20 text-gold border border-gold/40"
                        : "bg-bg-primary text-txt-muted border border-border-subtle"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={submitReview}
              disabled={submitting || reviewForm.rating === 0}
              className="w-full py-3.5 bg-gold text-bg-primary rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-gold/90 transition-colors"
            >
              {submitting ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Review
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Users,
  Trophy,
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

interface ProjectStanding {
  projectId: string;
  projectName: string;
  projectSlug: string;
  trustScore: number;
  category: string;
  image: string | null;
  totalStake: number;
  positionCount: number;
  voterCount: number;
}

interface Position {
  id: string;
  projectId: string;
  projectName: string;
  voterId: string;
  amount: number;
  payout: number | null;
  createdAt: string;
}

interface MarketDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "closed" | "resolved";
  opensAt: string;
  closesAt: string;
  resolvedAt: string | null;
  totalPool: number;
  winnerIds: string[];
  positionCount: number;
  projectStandings: ProjectStanding[];
  positions: Position[];
}

interface EligibleProject {
  id: string;
  name: string;
  slug: string;
  trustScore: number;
  category: string;
}

function formatTimeRemaining(closesAt: string) {
  const now = new Date();
  const close = new Date(closesAt);
  const diff = close.getTime() - now.getTime();

  if (diff <= 0) return "ENDED";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function truncateAddress(addr: string) {
  if (!addr) return "anon";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, authenticated, login } = usePrivy();

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibleProjects, setEligibleProjects] = useState<EligibleProject[]>([]);

  // Betting form state
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [stakeAmount, setStakeAmount] = useState<string>("10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchMarket();
    fetchProjects();
  }, [id]);

  async function fetchMarket() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/markets/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/markets");
          return;
        }
        throw new Error("Failed to fetch market");
      }
      const data = await res.json();
      setMarket(data);
    } catch (err) {
      console.error("Failed to fetch market:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProjects() {
    try {
      // Use agentScore table (ACP agents) instead of old project table
      const res = await fetch("/api/v1/agents?sort=jobs&limit=200");
      const data = await res.json();
      if (data.agents) {
        setEligibleProjects(
          data.agents.map((a: any) => ({
            id: a.id,
            name: a.name || a.id.slice(0, 10),
            slug: a.id,
            trustScore: a.trust?.score ?? 0,
            category: a.category || "Agent",
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  }

  async function handleStake() {
    if (!authenticated || !user?.wallet?.address) {
      login();
      return;
    }

    if (!selectedProject) {
      setError("Please select a project to stake on");
      return;
    }

    const amount = parseInt(stakeAmount);
    if (isNaN(amount) || amount < 1) {
      setError("Stake must be at least 1 Scarab");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/v1/markets/${id}/position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          amount,
          reviewer: user.wallet.address,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to stake");
        return;
      }

      setSuccess(`Successfully staked ${amount} Scarab on ${data.position.projectName}!`);
      setSelectedProject("");
      setStakeAmount("10");
      fetchMarket(); // Refresh market data
    } catch (err) {
      setError("Failed to submit stake. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5]">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <Shield className="w-8 h-8 text-[#3b82f6] animate-pulse" />
          <span className="text-xs font-mono text-[#666666] uppercase tracking-widest mt-3">
            LOADING MARKET...
          </span>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5]">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <XCircle className="w-8 h-8 text-[#3b82f6]" />
          <span className="text-sm font-mono text-[#666666] mt-3">Market not found</span>
          <Link
            href="/markets"
            className="mt-4 text-xs font-mono text-[#3b82f6] hover:underline"
          >
            ← Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const isOpen = market.status === "open" && formatTimeRemaining(market.closesAt) !== "ENDED";
  const winnerSet = new Set(market.winnerIds);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5]">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Back Link */}
        <Link
          href="/markets"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#666666] hover:text-[#3b82f6] transition-colors mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          BACK TO MARKETS
        </Link>

        {/* Market Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1 className="text-xl font-bold text-[#E5E5E5]">{market.title}</h1>
            <span
              className={`px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wide rounded border ${
                market.status === "open"
                  ? "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30"
                  : market.status === "resolved"
                  ? "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30"
                  : "bg-[#666666]/10 text-[#666666] border-[#666666]/30"
              }`}
            >
              {market.status}
            </span>
          </div>
          <p className="text-sm font-mono text-[#666666]">{market.description}</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Total Pool</span>
            </div>
            <span className="text-xl font-bold font-mono text-[#E5E5E5]">
              {market.totalPool.toLocaleString()} 🪲
            </span>
          </div>

          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-[#6366f1]" />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Positions</span>
            </div>
            <span className="text-xl font-bold font-mono text-[#E5E5E5]">
              {market.positionCount}
            </span>
          </div>

          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-4 h-4 ${isOpen ? "text-[#3b82f6]" : "text-[#666666]"}`} />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Time Left</span>
            </div>
            <span className={`text-xl font-bold font-mono ${isOpen ? "text-[#3b82f6]" : "text-[#666666]"}`}>
              {formatTimeRemaining(market.closesAt)}
            </span>
          </div>

          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-[#06b6d4]" />
              <span className="text-[10px] font-mono text-[#666666] uppercase">Category</span>
            </div>
            <span className="text-lg font-bold font-mono text-[#E5E5E5] uppercase">
              {market.category.replace("-", " ")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Standings + Betting Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Standings */}
            <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
              <h2 className="text-sm font-mono text-[#666666] uppercase tracking-widest mb-4">
                // PROJECT STANDINGS
              </h2>

              {market.projectStandings.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="w-8 h-8 text-[#666666] mx-auto mb-2" />
                  <p className="text-xs font-mono text-[#666666]">No stakes yet. Be the first!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {market.projectStandings.map((project, idx) => {
                    const isWinner = winnerSet.has(project.projectId);
                    return (
                      <div
                        key={project.projectId}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          isWinner
                            ? "bg-[#3b82f6]/5 border-[#3b82f6]/30"
                            : "bg-[#0A0A0A] border-[#1F1F1F]"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono ${
                            idx === 0
                              ? "bg-[#06b6d4]/20 text-[#06b6d4]"
                              : idx === 1
                              ? "bg-[#94A3B8]/20 text-[#94A3B8]"
                              : idx === 2
                              ? "bg-[#CD7F32]/20 text-[#CD7F32]"
                              : "bg-[#333] text-[#666]"
                          }`}
                        >
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/agent/${project.projectSlug}`}
                            className="text-sm font-semibold text-[#E5E5E5] hover:text-[#3b82f6] transition-colors truncate block"
                          >
                            {project.projectName}
                            {isWinner && (
                              <Trophy className="w-3 h-3 text-[#3b82f6] inline ml-1.5" />
                            )}
                          </Link>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-[#666666]">
                            <span>Trust: {project.trustScore ?? 0}</span>
                            <span>•</span>
                            <span>{project.voterCount} voters</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-bold font-mono text-[#E5E5E5]">
                            {project.totalStake.toLocaleString()} 🪲
                          </div>
                          <div className="text-[10px] font-mono text-[#666666]">
                            {market.totalPool > 0
                              ? `${((project.totalStake / market.totalPool) * 100).toFixed(1)}%`
                              : "0%"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stake Form */}
            {isOpen && (
              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
                <h2 className="text-sm font-mono text-[#666666] uppercase tracking-widest mb-4">
                  // PLACE YOUR STAKE
                </h2>

                {error && (
                  <div className="mb-4 p-3 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-[#3b82f6]" />
                    <span className="text-xs font-mono text-[#3b82f6]">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="mb-4 p-3 bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#3b82f6]" />
                    <span className="text-xs font-mono text-[#3b82f6]">{success}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Project Select */}
                  <div>
                    <label className="block text-[10px] font-mono text-[#666666] uppercase mb-2">
                      SELECT PROJECT
                    </label>
                    <select
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                      className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg px-3 py-2 text-sm font-mono text-[#E5E5E5] outline-none focus:border-[#3b82f6]/40"
                    >
                      <option value="">Choose a project...</option>
                      {eligibleProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Trust: {p.trustScore ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block text-[10px] font-mono text-[#666666] uppercase mb-2">
                      STAKE AMOUNT (MIN 50)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="50"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg px-3 py-2 pr-12 text-sm font-mono text-[#E5E5E5] outline-none focus:border-[#3b82f6]/40"
                        placeholder="50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">🪲</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {[50, 100, 250, 500].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setStakeAmount(amt.toString())}
                          className="px-2 py-1 text-[10px] font-mono text-[#666666] border border-[#1F1F1F] rounded hover:border-[#3b82f6]/40 hover:text-[#3b82f6] transition-colors"
                        >
                          {amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleStake}
                    disabled={submitting}
                    className="w-full py-3 bg-[#3b82f6] hover:bg-[#3b82f6]/80 disabled:bg-[#333] disabled:cursor-not-allowed rounded-lg text-sm font-mono font-bold text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        STAKING...
                      </>
                    ) : !authenticated ? (
                      "CONNECT WALLET TO STAKE"
                    ) : (
                      "STAKE SCARAB"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Recent Positions */}
          <div className="space-y-6">
            <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
              <h2 className="text-sm font-mono text-[#666666] uppercase tracking-widest mb-4">
                // RECENT POSITIONS
              </h2>

              {market.positions.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-6 h-6 text-[#666666] mx-auto mb-2" />
                  <p className="text-xs font-mono text-[#666666]">No positions yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {market.positions.slice(0, 20).map((pos) => (
                    <div
                      key={pos.id}
                      className="flex items-center justify-between p-2 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-mono text-[#E5E5E5] truncate block">
                          {pos.projectName}
                        </span>
                        <span className="text-[9px] font-mono text-[#666666]">
                          {truncateAddress(pos.voterId)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-[#E5E5E5]">
                          {pos.amount} 🪲
                        </span>
                        {pos.payout !== null && (
                          <span
                            className={`block text-[9px] font-mono ${
                              pos.payout > 0 ? "text-[#3b82f6]" : "text-[#3b82f6]"
                            }`}
                          >
                            {pos.payout > 0 ? `+${pos.payout}` : "0"} payout
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Market Rules */}
            <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4">
              <h2 className="text-sm font-mono text-[#666666] uppercase tracking-widest mb-3">
                // RULES
              </h2>
              <div className="space-y-2 text-[10px] font-mono text-[#666666]">
                <p>• Top 3 projects by trust score win</p>
                <p>• Winners split 95% of loser pool</p>
                <p>• 5% of loser pool is burned</p>
                <p>• Winners get: stake + share of winnings</p>
                <p>• Minimum stake: 50 Scarab</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

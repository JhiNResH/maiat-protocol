"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Shield, TrendingUp, Users, Clock, AlertTriangle, 
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

interface ProjectStanding {
  projectId: string;
  projectName: string;
  image: string | null;
  totalStake: number;
  positionCount: number;
  voterCount: number;
  trustScore: number;
}

interface MarketDetail {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed" | "resolved";
  totalPool: number;
  positionCount: number;
  closesAt: string;
  projectStandings: ProjectStanding[];
  positions: any[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MarketDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Shield className="w-8 h-8 text-[var(--text-secondary)] animate-pulse" />
      </div>
    }>
      <MarketDetailContent />
    </Suspense>
  )
}

function MarketDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const marketId = params.id as string;
  const prefillAgent = searchParams.get("agent");
  const prefillName = searchParams.get("name");
  const { authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy');
  const walletAddress = externalWallet?.address ?? user?.wallet?.address;

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [stakeMsg, setStakeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [agentSearch, setAgentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ walletAddress: string; name: string; trustScore: number; profilePic: string | null }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (marketId) fetchMarket();
  }, [marketId]);

  async function fetchMarket() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/markets/${marketId}`);
      const data = await res.json();
      const marketData = data.market ?? data;
      if (marketData?.id) {
        setMarket(marketData);
        if (marketData.projectStandings?.length > 0) {
          setSelectedProjectId(marketData.projectStandings[0].projectId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch market:", err);
    } finally {
      setLoading(false);
    }
  }

  const { data: scarab } = useSWR(walletAddress ? `/api/v1/scarab?address=${walletAddress}` : null, fetcher);

  useEffect(() => {
    if (prefillAgent && !selectedProjectId) {
      setSelectedProjectId(prefillAgent);
      if (prefillName) setAgentSearch(prefillName);
    }
  }, [prefillAgent, prefillName]);

  useEffect(() => {
    if (agentSearch.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/agents?search=${encodeURIComponent(agentSearch)}&limit=5`);
        const data = await res.json();
        setSearchResults((data.agents ?? []).map((a: any) => ({
          walletAddress: a.id || a.walletAddress,
          name: a.name || a.id?.slice(0, 10) + '...',
          trustScore: a.trust?.score ?? a.trustScore ?? 0,
          profilePic: a.logo || null,
        })));
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [agentSearch]);

  async function handleStake() {
    if (!authenticated) return login();
    if (!selectedProjectId || !amount || staking) return;
    
    setStaking(true);
    setStakeMsg(null);

    try {
      const res = await fetch(`/api/v1/markets/${marketId}/position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          amount: Number(amount),
          reviewer: walletAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stake failed");

      setStakeMsg({ ok: true, text: `Successfully staked ${amount} 🪲!` });
      setAmount("");
      setAgentSearch("");
      setSearchResults([]);
      fetchMarket();
    } catch (err: any) {
      setStakeMsg({ ok: false, text: err.message });
    } finally {
      setStaking(false);
    }
  }

  function formatTimeRemaining(closesAt: string) {
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return 'ENDED';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest animate-pulse">Loading market...</p>
    </div>
  );

  if (!market) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <AlertTriangle className="text-rose-500 w-10 h-10" />
      <p className="text-sm font-bold text-[var(--text-color)]">Market not found</p>
      <Link href="/markets" className="text-xs font-bold text-emerald-500 hover:underline">← Back to markets</Link>
    </div>
  );

  const isActive = market.status === 'open' && formatTimeRemaining(market.closesAt) !== 'ENDED';

  return (
    <div className="min-h-screen pb-20">
      <main className="max-w-5xl mx-auto px-6 pt-8">
        
        {/* Navigation */}
        <div className="flex items-center justify-between mb-12">
          <Link href="/markets" className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-color)] uppercase tracking-widest transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
          <span className={cn(
            "px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest",
            isActive
              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-[var(--card-bg)] text-[var(--text-muted)]'
          )}>
            {market.status}
          </span>
        </div>

        {/* Winner celebration banner */}
        {market.status === 'resolved' && walletAddress && (() => {
          const myPositions = market.positions?.filter(
            (p: any) => p.voterId?.toLowerCase() === walletAddress.toLowerCase()
          ) ?? [];
          const myWinnings = myPositions.reduce((sum: number, p: any) => sum + (p.payout ?? 0), 0);
          const myStake = myPositions.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
          const profit = myWinnings - myStake;
          if (myWinnings > 0) return (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="liquid-glass rounded-[3rem] p-12 mb-12 hover-lift"
            >
              <div className="flex flex-col md:flex-row items-center gap-10">
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-3">Market Resolved</div>
                  <h2 className="text-4xl font-black text-[var(--text-color)] mb-3 tracking-tight">You won 🏆</h2>
                  <p className="text-[var(--text-secondary)] text-base font-medium">
                    Your pick paid off. {profit > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{profit} 🪲 profit</span>}
                  </p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Staked</div>
                    <div className="text-3xl font-black text-[var(--text-color)]">{myStake}</div>
                  </div>
                  <div className="text-xl text-[var(--text-muted)]">→</div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">Payout</div>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{myWinnings}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
          if (myStake > 0 && myWinnings === 0) return (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="liquid-glass rounded-[3rem] p-12 mb-12"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500 mb-3">Market Resolved</div>
              <h2 className="text-2xl font-black text-[var(--text-color)] mb-2">Better luck next time</h2>
              <p className="text-sm text-[var(--text-secondary)]">
                You staked <span className="font-bold">{myStake} 🪲</span> — the market has been resolved.
              </p>
            </motion.div>
          );
          return null;
        })()}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Market Info */}
          <div className="lg:col-span-7 space-y-10">
            <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tight text-[var(--text-color)]">{market.title}</h1>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                {market.description}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="liquid-glass p-6 rounded-[2rem]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Pool</p>
                <p className="text-xl font-black text-[var(--text-color)]">{market.totalPool.toLocaleString()} 🪲</p>
              </div>
              <div className="liquid-glass p-6 rounded-[2rem]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Positions</p>
                <p className="text-xl font-black text-[var(--text-color)]">{market.positionCount}</p>
              </div>
              <div className="liquid-glass p-6 rounded-[2rem]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">Closes</p>
                <p className={cn("text-xl font-black", isActive ? 'text-emerald-500' : 'text-[var(--text-muted)]')}>
                  {formatTimeRemaining(market.closesAt)}
                </p>
              </div>
            </div>

            {/* Positions List */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Users size={16} className="text-[var(--text-muted)]" />
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Current Positions</h2>
                <div className="flex-1 h-px bg-[var(--border-color)]" />
              </div>
              <div className="space-y-3">
                {(market.projectStandings ?? []).map(standing => {
                  const shareOfPool = market.totalPool > 0 ? (standing.totalStake / market.totalPool * 100) : 0;
                  return (
                    <div 
                      key={standing.projectId}
                      onClick={() => setSelectedProjectId(standing.projectId)}
                      className={cn(
                        "flex items-center justify-between p-6 rounded-[2rem] border transition-all cursor-pointer group",
                        selectedProjectId === standing.projectId
                          ? 'liquid-glass border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                          : 'bg-[var(--card-bg)] border-[var(--border-color)] hover:border-emerald-500/20'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--card-bg)] p-1">
                          <img src={standing.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${standing.projectId}&backgroundColor=transparent`} alt="" className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[var(--text-color)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{standing.projectName}</p>
                          <p className="text-[10px] font-bold text-[var(--text-muted)]">{shareOfPool.toFixed(1)}% of pool · {standing.voterCount} voter{standing.voterCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-[var(--text-color)]">{standing.totalStake.toLocaleString()} 🪲</p>
                        <p className="text-[10px] font-bold text-emerald-500">Trust: {standing.trustScore}</p>
                      </div>
                    </div>
                  );
                })}
                {(market.projectStandings ?? []).length === 0 && (
                  <div className="liquid-glass rounded-[2.5rem] p-12 text-center">
                    <p className="text-sm text-[var(--text-muted)] font-medium">No positions yet — be the first to stake</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stake Interface */}
          <div className="lg:col-span-5 space-y-6">
            <div className="liquid-glass rounded-[2.5rem] p-8 sticky top-8">
              <div className="flex items-center gap-3 mb-8">
                <TrendingUp size={18} className="text-emerald-500" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Stake Position</h3>
              </div>

              <div className="space-y-6">
                {/* Agent Search */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Search Agent</p>
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search by name or address..."
                    className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl py-3 px-5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all text-[var(--text-color)] placeholder:text-[var(--text-muted)]"
                  />
                  {searching && <p className="text-[9px] text-[var(--text-muted)] animate-pulse">Searching...</p>}
                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {searchResults.map((agent) => (
                        <div
                          key={agent.walletAddress}
                          onClick={() => {
                            setSelectedProjectId(agent.walletAddress);
                            setAgentSearch(agent.name);
                            setSearchResults([]);
                          }}
                          className="flex items-center justify-between p-3 rounded-2xl border border-[var(--border-color)] hover:border-emerald-500/30 cursor-pointer transition-all bg-[var(--card-bg)]"
                        >
                          <div className="flex items-center gap-3">
                            <img src={agent.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.walletAddress}&backgroundColor=transparent`} alt="" className="w-7 h-7 rounded-xl" />
                            <span className="text-xs font-bold text-[var(--text-color)]">{agent.name}</span>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-500">Trust: {agent.trustScore}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Amount</p>
                    <p className="text-[10px] font-bold text-[var(--text-muted)]">Balance: {scarab?.balance ?? 0} 🪲</p>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl py-4 pl-5 pr-12 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 transition-all text-[var(--text-color)]"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm">🪲</span>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[var(--text-muted)]">Target</span>
                    <span className="font-bold text-[var(--text-color)] truncate max-w-[160px]">
                      {market.projectStandings?.find(p => p.projectId === selectedProjectId)?.projectName 
                        || agentSearch 
                        || 'Select above'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[var(--text-muted)]">ID</span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)] truncate max-w-[160px]">
                      {selectedProjectId ? `${selectedProjectId.slice(0, 8)}...${selectedProjectId.slice(-6)}` : '—'}
                    </span>
                  </div>
                </div>

                {/* Submit */}
                <button 
                  onClick={handleStake}
                  disabled={staking || !selectedProjectId || !amount}
                  className="w-full py-4 bg-[var(--text-color)] hover:opacity-90 disabled:opacity-30 text-[var(--bg-color)] font-bold text-xs rounded-2xl transition-all uppercase tracking-widest shadow-xl active:scale-[0.98]"
                >
                  {staking ? "Processing..." : "Stake"}
                </button>

                {stakeMsg && (
                  <p className={cn(
                    "text-center text-xs font-bold",
                    stakeMsg.ok ? 'text-emerald-500' : 'text-rose-500'
                  )}>
                    {stakeMsg.text}
                  </p>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
                <div className="flex items-start gap-3">
                  <Info size={14} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed font-medium">
                    Minimum 10 Scarab. Positions locked until market resolution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

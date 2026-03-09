"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { 
  ArrowLeft, Shield, TrendingUp, Users, Clock, Zap, AlertTriangle, 
  ChevronRight, CheckCircle, Info, ExternalLink, Trophy
} from "lucide-react";
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
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center font-mono text-[#3b82f6]">LOADING SECTOR…</div>}>
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
  const walletAddress = user?.wallet?.address;

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

  // Auto-fill agent from URL params (e.g. from agent page "Stake" button)
  useEffect(() => {
    if (prefillAgent && !selectedProjectId) {
      setSelectedProjectId(prefillAgent);
      if (prefillName) setAgentSearch(prefillName);
    }
  }, [prefillAgent, prefillName]);

  // Agent search for staking on new agents
  useEffect(() => {
    if (agentSearch.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/agent/search?q=${encodeURIComponent(agentSearch)}&limit=5`);
        const data = await res.json();
        setSearchResults(data.results ?? []);
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

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center">
      <p className="font-mono text-[#666666] text-xs animate-pulse tracking-[0.3em]">
        // SYNCING MARKET DATA…
      </p>
    </div>
  );

  if (!market) return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center gap-4">
      <AlertTriangle className="text-red-500 w-10 h-10" />
      <p className="font-mono text-[#E5E5E5] text-sm">MARKET NOT FOUND</p>
      <Link href="/markets" className="text-[#3b82f6] text-xs font-mono hover:underline">← back to markets</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[#E5E5E5] font-['JetBrains_Mono',monospace]">
      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/markets" className="flex items-center gap-2 text-[10px] font-mono text-[#666666] hover:text-[#999] uppercase tracking-widest transition-colors">
            <ArrowLeft size={14} /> Back to Markets
          </Link>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider border ${market.status === 'open' ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' : 'bg-[#666666]/10 border-[#666666]/30 text-[#666666]'}`}>
              {market.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Market Info */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-4">
              <h1 className="text-2xl font-bold tracking-tight text-white uppercase">{market.title}</h1>
              <p className="text-sm text-[#666666] leading-relaxed italic border-l-2 border-[#3b82f6]/20 pl-4">
                {market.description}
              </p>
            </div>

            {/* Positions List */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#666666] uppercase tracking-widest mb-4">
                <Users size={14} /> // Current Market Positions
              </div>
              <div className="space-y-2">
                {(market.projectStandings ?? []).map(standing => {
                  const shareOfPool = market.totalPool > 0 ? (standing.totalStake / market.totalPool * 100) : 0;
                  return (
                    <div 
                      key={standing.projectId}
                      onClick={() => setSelectedProjectId(standing.projectId)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group ${selectedProjectId === standing.projectId ? 'bg-[#3b82f6]/5 border-[#3b82f6]/40 shadow-[0_0_20px_rgba(59,130,246,0.05)]' : 'bg-[var(--bg-surface)] border-[var(--border-default)] hover:border-[#333]'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--border-default)] bg-[var(--bg-page)] p-1">
                          <img src={standing.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${standing.projectId}&backgroundColor=transparent`} alt="" className="w-full h-full object-cover rounded" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-[#3b82f6] transition-colors">{standing.projectName}</p>
                          <p className="text-[10px] font-mono text-[#666666]">{shareOfPool.toFixed(1)}% of pool · {standing.voterCount} voter{standing.voterCount !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-white">{standing.totalStake.toLocaleString()} 🪲</p>
                        <p className="text-[9px] font-mono text-[#3b82f6]">Trust: {standing.trustScore}/100</p>
                      </div>
                    </div>
                  );
                })}
                {(market.projectStandings ?? []).length === 0 && (
                  <p className="text-[10px] font-mono text-[#666666] text-center py-8">No positions yet — be the first to stake</p>
                )}
              </div>
            </div>
          </div>

          {/* Stake Interface */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl p-6 sticky top-8">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={16} className="text-[#3b82f6]" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#666666]">Execute Position</h3>
              </div>

              <div className="space-y-6">
                {/* Agent Search */}
                <div className="space-y-3">
                  <div className="text-[10px] font-mono text-[#666666] uppercase">Search Agent to Stake On</div>
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search by name or address..."
                    className="w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl py-2.5 px-4 text-xs font-mono focus:outline-none focus:border-[#3b82f6]/50 transition-all text-white placeholder-[#444]"
                  />
                  {searching && <p className="text-[9px] font-mono text-[#666] animate-pulse">Searching...</p>}
                  {searchResults.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {searchResults.map((agent) => (
                        <div
                          key={agent.walletAddress}
                          onClick={() => {
                            setSelectedProjectId(agent.walletAddress);
                            setAgentSearch(agent.name);
                            setSearchResults([]);
                          }}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border-default)] hover:border-[#3b82f6]/40 cursor-pointer transition-all bg-[var(--bg-page)] hover:bg-[#3b82f6]/5"
                        >
                          <div className="flex items-center gap-2">
                            <img src={agent.profilePic || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.walletAddress}&backgroundColor=transparent`} alt="" className="w-6 h-6 rounded" />
                            <span className="text-xs font-mono text-white">{agent.name}</span>
                          </div>
                          <span className="text-[9px] font-mono text-[#3b82f6]">Trust: {agent.trustScore}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-mono text-[#666666] uppercase">
                    <span>Stake Amount</span>
                    <span>Available: {scarab?.balance ?? 0} 🪲</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl py-3 pl-4 pr-12 text-sm font-mono focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#666666]">🪲</span>
                  </div>
                </div>

                <div className="bg-[var(--bg-page)] border border-[var(--border-default)] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#666666]">Target Agent</span>
                    <span className="text-white truncate max-w-[150px]">
                      {market.projectStandings?.find(p => p.projectId === selectedProjectId)?.projectName 
                        || agentSearch 
                        || 'Search or select above'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#666666]">Selected ID</span>
                    <span className="text-[#666] truncate max-w-[150px] text-[8px]">
                      {selectedProjectId ? `${selectedProjectId.slice(0, 8)}...${selectedProjectId.slice(-6)}` : '—'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={handleStake}
                  disabled={staking || !selectedProjectId || !amount}
                  className="w-full py-3.5 bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 disabled:hover:bg-[#3b82f6] text-white font-bold text-xs rounded-xl transition-all uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                >
                  {staking ? "Syncing Transaction…" : "Commit Stake"}
                </button>

                {stakeMsg && (
                  <p className={`text-center text-[10px] font-mono uppercase tracking-wide ${stakeMsg.ok ? 'text-[#10b981]' : 'text-red-400'}`}>
                    {stakeMsg.text}
                  </p>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-[var(--border-default)] space-y-4">
                <div className="flex items-start gap-3">
                  <Info size={14} className="text-[#3b82f6] shrink-0" />
                  <p className="text-[10px] text-[#666666] leading-relaxed">
                    Staking requires a minimum of 10 Scarab. Positions are locked until market resolution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Rules Footer */}
        <div className="mt-12 pt-6 border-t border-[var(--border-default)] opacity-50">
          <div className="text-[9px] font-mono text-[#666666] uppercase tracking-[0.2em] text-center">
            Maiat Market Protocol // Resolution Epoch: 14 Days // Network: Mainnet
          </div>
        </div>
      </main>
    </div>
  );
}

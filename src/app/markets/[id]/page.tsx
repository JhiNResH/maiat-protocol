"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { 
  ArrowLeft, Shield, TrendingUp, Users, Clock, Zap, AlertTriangle, 
  ChevronRight, CheckCircle, Info, ExternalLink, Trophy
} from "lucide-react";
import useSWR from "swr";

interface Position {
  id: string;
  projectId: string;
  projectName: string;
  projectLogo: string | null;
  totalStake: number;
  shareOfPool: number;
  potentialPayout: number;
}

interface MarketDetail {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed" | "resolved";
  totalPool: number;
  positionCount: number;
  closesAt: string;
  positions: Position[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MarketDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center font-mono text-[#3b82f6]">LOADING SECTOR…</div>}>
      <MarketDetailContent />
    </Suspense>
  )
}

function MarketDetailContent() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;
  const { authenticated, user, login } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = user?.wallet?.address;

  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [stakeMsg, setStakeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (marketId) fetchMarket();
  }, [marketId]);

  async function fetchMarket() {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/markets/${marketId}`);
      const data = await res.json();
      // API returns market fields directly (not nested under .market)
      const marketData = data.market ?? data;
      if (marketData?.id) {
        setMarket(marketData);
        if (marketData.positions?.length > 0) {
          setSelectedProjectId(marketData.positions[0].projectId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch market:", err);
    } finally {
      setLoading(false);
    }
  }

  const { data: scarab } = useSWR(walletAddress ? `/api/v1/scarab?address=${walletAddress}` : null, fetcher);

  async function handleStake() {
    if (!authenticated) return login();
    if (!selectedProjectId || !amount || staking) return;
    
    setStaking(true);
    setStakeMsg(null);

    try {
      const activeWallet = wallets.find((w) => w.address.toLowerCase() === walletAddress?.toLowerCase());
      if (!activeWallet) throw new Error("Wallet not ready");

      const res = await fetch("/api/v1/markets/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: walletAddress,
          marketId,
          projectId: selectedProjectId,
          amount: Number(amount)
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stake failed");

      setStakeMsg({ ok: true, text: `Successfully staked ${amount} 🪲!` });
      setAmount("");
      fetchMarket();
    } catch (err: any) {
      setStakeMsg({ ok: false, text: err.message });
    } finally {
      setStaking(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <p className="font-mono text-[#666666] text-xs animate-pulse tracking-[0.3em]">
        // SYNCING MARKET DATA…
      </p>
    </div>
  );

  if (!market) return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4">
      <AlertTriangle className="text-red-500 w-10 h-10" />
      <p className="font-mono text-[#E5E5E5] text-sm">MARKET NOT FOUND</p>
      <Link href="/markets" className="text-[#3b82f6] text-xs font-mono hover:underline">← back to markets</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E5E5] font-['JetBrains_Mono',monospace]">
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
                {market.positions.map(pos => (
                  <div 
                    key={pos.projectId}
                    onClick={() => setSelectedProjectId(pos.projectId)}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer group ${selectedProjectId === pos.projectId ? 'bg-[#3b82f6]/5 border-[#3b82f6]/40 shadow-[0_0_20px_rgba(59,130,246,0.05)]' : 'bg-[#111111] border-[#1F1F1F] hover:border-[#333]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg overflow-hidden border border-[#1F1F1F] bg-[#0A0A0A] p-1">
                        <img src={pos.projectLogo || `https://api.dicebear.com/7.x/bottts/svg?seed=${pos.projectId}&backgroundColor=transparent`} alt="" className="w-full h-full object-cover rounded" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-[#3b82f6] transition-colors">{pos.projectName}</p>
                        <p className="text-[10px] font-mono text-[#666666]">{pos.shareOfPool.toFixed(1)}% of pool</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-white">{pos.totalStake.toLocaleString()} 🪲</p>
                      <p className="text-[9px] font-mono text-[#10b981]">Payout: {pos.potentialPayout.toFixed(2)}x</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stake Interface */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#111111] border border-[#1F1F1F] rounded-2xl p-6 sticky top-8">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={16} className="text-[#3b82f6]" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#666666]">Execute Position</h3>
              </div>

              <div className="space-y-6">
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
                      className="w-full bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl py-3 pl-4 pr-12 text-sm font-mono focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#666666]">🪲</span>
                  </div>
                </div>

                <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#666666]">Target Agent</span>
                    <span className="text-white truncate max-w-[150px]">
                      {market.positions.find(p => p.projectId === selectedProjectId)?.projectName || 'Select above'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-[#666666]">Expected Payout</span>
                    <span className="text-[#10b981]">
                      {market.positions.find(p => p.projectId === selectedProjectId)?.potentialPayout.toFixed(2)}x
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

              <div className="mt-8 pt-6 border-t border-[#1F1F1F] space-y-4">
                <div className="flex items-start gap-3">
                  <Info size={14} className="text-[#3b82f6] shrink-0" />
                  <p className="text-[10px] text-[#666666] leading-relaxed">
                    Staking requires a minimum of 50 Scarab. Positions are locked until market resolution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Rules Footer */}
        <div className="mt-12 pt-6 border-t border-[#1F1F1F] opacity-50">
          <div className="text-[9px] font-mono text-[#666666] uppercase tracking-[0.2em] text-center">
            Maiat Market Protocol // Resolution Epoch: 14 Days // Network: Mainnet
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Home, 
  Trophy, 
  LayoutDashboard, 
  Search, 
  Repeat, 
  FileText, 
  Github,
  TrendingUp,
  MessageSquare,
  Users,
  Flame
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

const mainNav = [
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/explore?tab=leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/swap", label: "Swap", icon: Repeat },
];

const resourceNav = [
  { href: "/docs", label: "API Docs", icon: FileText },
  { href: "https://github.com/JhiNResH/maiat", label: "GitHub", icon: Github, external: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLeaderboard = searchParams.get('tab') === 'leaderboard';
  const { authenticated, ready, user } = usePrivy();
  const walletAddress = user?.wallet?.address;
  const [scarabBalance, setScarabBalance] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    fetch(`/api/v1/scarab?address=${walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setScarabBalance(d.balance));
  }, [walletAddress, claimResult]);

  async function handleClaim() {
    if (!walletAddress || claiming) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/v1/scarab/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress }),
      });
      const data = await res.json();
      setClaimResult(data.alreadyClaimed ? 'done' : `+${data.amount ?? 5}`);
      setTimeout(() => setClaimResult(null), 3000);
    } finally { setClaiming(false); }
  }

  return (
    <aside className="fixed top-[73px] left-0 h-[calc(100vh-73px)] w-[240px] bg-[#030303] border-r border-[#1a1a1b] overflow-y-auto z-40 hidden lg:flex flex-col p-4 gap-2">
      
      {/* Feed Section */}
      <div className="flex flex-col gap-1">
        <p className="px-3 text-[10px] font-bold text-[#818384] uppercase tracking-widest mb-2 font-mono">Feeds</p>
        <Link
          href="/explore"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-bold transition-all ${
            pathname === "/explore" && !isLeaderboard
              ? "bg-[#1a1a1b] text-gold"
              : "text-[#d7dadc] hover:bg-[#1a1a1b]"
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Hot Projects</span>
        </Link>
        <Link
          href="/explore?tab=leaderboard"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-bold transition-all ${
            isLeaderboard
              ? "bg-[#1a1a1b] text-gold"
              : "text-[#d7dadc] hover:bg-[#1a1a1b]"
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span>Leaderboard</span>
        </Link>
      </div>

      <div className="h-px bg-[#1a1a1b] my-4 mx-2" />

      {/* Account Section */}
      <div className="flex flex-col gap-1">
        <p className="px-3 text-[10px] font-bold text-[#818384] uppercase tracking-widest mb-2 font-mono">Account</p>
        {ready && authenticated ? (
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-bold transition-all ${
              pathname === "/dashboard"
                ? "bg-[#1a1a1b] text-gold"
                : "text-[#d7dadc] hover:bg-[#1a1a1b]"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span>Reputation Passport</span>
          </Link>
        ) : (
          <div className="px-3 py-2 text-xs text-[#818384] italic">Connect wallet to view passport</div>
        )}
        <Link
          href="/swap"
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-bold transition-all ${
            pathname === "/swap"
              ? "bg-[#1a1a1b] text-gold"
              : "text-[#d7dadc] hover:bg-[#1a1a1b]"
          }`}
        >
          <Repeat className="w-5 h-5" />
          <span>Protected Swap</span>
        </Link>
      </div>

      <div className="h-px bg-[#1a1a1b] my-4 mx-2" />

      {/* Communities Section (Categories) */}
      <div className="flex flex-col gap-1">
        <p className="px-3 text-[10px] font-bold text-[#818384] uppercase tracking-widest mb-2 font-mono">Communities</p>
        <Link href="/explore?cat=agents" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[#d7dadc] hover:bg-[#1a1a1b]">
          <Users className="w-4 h-4" /> m/agents
        </Link>
        <Link href="/explore?cat=defi" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[#d7dadc] hover:bg-[#1a1a1b]">
          <Users className="w-4 h-4" /> m/defi
        </Link>
        <Link href="/explore?cat=memecoins" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[#d7dadc] hover:bg-[#1a1a1b]">
          <Users className="w-4 h-4" /> m/memecoins
        </Link>
      </div>

      <div className="mt-auto">
        <div className="h-px bg-[#1a1a1b] mb-4 mx-2" />
        <div className="flex flex-col gap-1">
          {resourceNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-xs font-bold text-[#818384] hover:text-white transition-all uppercase font-mono tracking-tighter"
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
        {/* Scarab daily claim */}
        {authenticated && (
          <div className="mx-2 mb-3 bg-[#d4a017]/8 border border-[#d4a017]/20 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[#d4a017]">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider">Scarab</span>
              </div>
              {scarabBalance !== null && (
                <span className="text-xs font-bold text-[#d4a017] font-mono">🪲 {scarabBalance}</span>
              )}
            </div>
            <button
              onClick={handleClaim}
              disabled={claiming || claimResult === 'done'}
              className="w-full py-1.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide transition-all bg-[#d4a017]/15 hover:bg-[#d4a017]/25 disabled:opacity-50 text-[#d4a017]"
            >
              {claiming ? '...' : claimResult && claimResult !== 'done' ? `${claimResult} 🪲` : claimResult === 'done' ? 'Claimed ✓' : 'Daily Claim'}
            </button>
          </div>
        )}

        <p className="px-3 py-4 text-[9px] text-[#4a4a4e] font-mono uppercase tracking-tighter">
          © 2026 Maiat Protocol v1.2
        </p>
      </div>
    </aside>
  );
}

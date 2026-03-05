"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Compass,
  Trophy,
  LayoutDashboard, 
  Repeat, 
  FileText, 
  Github,
  Flame,
  Shield,
  BarChart2,
  Bot,
  Radar,
} from "lucide-react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const navItems = [
  { href: "/explore", label: "Agents", icon: Bot, exact: true },
  { href: "/explore?tab=leaderboard", label: "Leaderboard", icon: Trophy, tabMatch: "leaderboard" },
  { href: "/agent", label: "Monitor", icon: Radar, exact: false },
  { href: "/markets", label: "Opinion Market", icon: BarChart2, exact: false },
];
// Phase 2: { href: "/review", label: "Write Review", icon: Shield, exact: false },

const accountItems = [
  { href: "/passport", label: "Trust Passport", icon: LayoutDashboard },
  // { href: "/swap", label: "Protected Swap", icon: Repeat }, // Hidden — demo only, TrustGateHook handles swap protection at contract level
];

const resourceItems = [
  { href: "/docs", label: "API Docs", icon: FileText },
  { href: "https://github.com/JhiNResH/maiat", label: "GitHub", icon: Github, external: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLeaderboard = searchParams.get('tab') === 'leaderboard';
  const { authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
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
      // 1. Fetch Nonce
      const nonceRes = await fetch(`/api/v1/scarab/nonce?address=${walletAddress}`);
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce, expiresAt } = await nonceRes.json();

      // 2. Sign Message
      const activeWallet = wallets.find((w) => w.address.toLowerCase() === walletAddress.toLowerCase());
      if (!activeWallet) throw new Error('Wallet not found');

      const message = [
        `Claim daily Scarab for ${activeWallet.address}`,
        `Nonce: ${nonce}`,
        `Expiration: ${expiresAt}`,
      ].join('\n');

      const signature = await activeWallet.sign(message);

      // 3. Submit Claim
      const res = await fetch('/api/v1/scarab/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: walletAddress,
          signature,
          nonce,
          expiresAt
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Claim failed');

      setClaimResult(data.alreadyClaimed ? 'done' : `+${data.amount ?? 5}`);
      setTimeout(() => setClaimResult(null), 3000);
    } catch (err: any) {
      console.error("[Claim] Error:", err.message);
      setClaimResult('fail');
      setTimeout(() => setClaimResult(null), 3000);
    } finally { setClaiming(false); }
  }

  function isActive(item: { href: string; exact?: boolean; tabMatch?: string }) {
    if (item.tabMatch) return isLeaderboard && item.tabMatch === 'leaderboard';
    if (item.exact) return pathname === item.href && !isLeaderboard;
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="fixed top-[64px] left-0 h-[calc(100vh-64px)] w-[220px] bg-[#050508] border-r border-[#1e2035] overflow-y-auto z-40 hidden lg:flex flex-col py-5 px-3 gap-1">
      
      {/* Nav */}
      <div className="flex flex-col gap-0.5">
        <p className="px-3 text-[9px] font-bold text-[#475569] uppercase tracking-widest mb-2 font-mono">Navigate</p>
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20"
                  : "text-[#94a3b8] hover:bg-[#0d0e17] hover:text-[#f1f5f9]"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />}
            </Link>
          );
        })}
      </div>

      <div className="h-px bg-[#1e2035] my-3 mx-2" />

      {/* Account */}
      <div className="flex flex-col gap-0.5">
        <p className="px-3 text-[9px] font-bold text-[#475569] uppercase tracking-widest mb-2 font-mono">Account</p>
        {ready && authenticated ? (
          accountItems.map((item) => {
            const href = item.href === '/passport' && walletAddress
              ? `/passport/${walletAddress}`
              : item.href;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20"
                    : "text-[#94a3b8] hover:bg-[#0d0e17] hover:text-[#f1f5f9]"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })
        ) : (
          <p className="px-3 py-2 text-xs text-[#475569] italic">Connect wallet to access</p>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <div className="h-px bg-[#1e2035] mb-3 mx-2" />

        {/* Resources */}
        <div className="flex flex-col gap-0.5 mb-3">
          {resourceItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-[#475569] hover:text-[#94a3b8] transition-all"
            >
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Scarab claim widget */}
        {authenticated && (
          <div className="mx-1 mb-3 bg-[#d4a017]/6 border border-[#d4a017]/15 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-[#d4a017]" />
                <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-[#d4a017]">Scarab</span>
              </div>
              {scarabBalance !== null && (
                <span className="text-xs font-bold text-[#d4a017] font-mono">🪲 {scarabBalance}</span>
              )}
            </div>
            <button
              onClick={handleClaim}
              disabled={claiming || claimResult === 'done'}
              className="w-full py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider transition-all bg-[#d4a017]/10 hover:bg-[#d4a017]/20 disabled:opacity-40 text-[#d4a017]"
            >
              {claiming ? '...' : claimResult && claimResult !== 'done' ? `${claimResult} 🪲` : claimResult === 'done' ? 'Claimed ✓' : 'Daily Claim'}
            </button>
          </div>
        )}

        <p className="px-3 pb-2 text-[9px] text-[#2a2d45] font-mono uppercase tracking-tighter">
          Maiat Protocol v1.2
        </p>
      </div>
    </aside>
  );
}

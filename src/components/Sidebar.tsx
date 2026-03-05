"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Compass,
  Trophy,
  LayoutDashboard, 
  Shield,
  Zap,
  Menu,
  X,
  Radar,
  Github,
  FileText,
  Flame,
  TrendingUp,
  Wallet,
  LogOut,
  User
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import useSWR from "swr";

// ─── Constants ───────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { name: "Monitor", icon: Radar, path: "/monitor" },
  { name: "Opinion Market", icon: TrendingUp, path: "/markets" },
  { name: "Explore", icon: Compass, path: "/explore" },
  { name: "Passport", icon: LayoutDashboard, path: "/dashboard" },
];

const fetcher = (url: string) => fetch(url).then(res => res.json());

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { authenticated, user, login, logout } = usePrivy();
  const walletAddress = user?.wallet?.address;

  // Fetch Scarab for Sidebar Widget
  const { data: scarab } = useSWR(walletAddress ? `/api/v1/scarab?address=${walletAddress}` : null, fetcher);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (path: string) => {
    if (path.includes('?')) {
      const [base, query] = path.split('?');
      const [key, val] = query.split('=');
      return pathname === base && searchParams.get(key) === val;
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (!mounted) return null;

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-[60] p-2 bg-[#050508] border border-[#1e2035] rounded-lg text-slate-400"
      >
        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 bottom-0 w-[220px] bg-[#050508] border-r border-[#1e2035] z-[55]
        transition-transform duration-300 ease-in-out lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Area */}
          <div className="h-[64px] flex items-center px-6 border-b border-[#1e2035]">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Image 
                src="/maiat-logo.jpg" 
                alt="Maiat" 
                width={20} 
                height={20} 
                className="w-5 h-5 rounded shadow-lg shadow-[#3b82f6]/20" 
              />
              <span className="font-mono text-sm font-bold tracking-[3px] text-white uppercase">
                MAIAT
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.name}
                href={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all group
                  ${isActive(item.path)
                    ? 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20 shadow-[0_0_20px_rgba(59,130,246,0.05)]'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={16} className={isActive(item.path) ? 'text-[#3b82f6]' : 'text-slate-600 group-hover:text-slate-400'} />
                  <span className="tracking-tight">{item.name}</span>
                </div>
                {isActive(item.path) && (
                  <div className="w-1 h-1 rounded-full bg-[#3b82f6] animate-pulse" />
                )}
              </Link>
            ))}
          </nav>

          {/* INTEGRATED IDENTITY & SCARAB WIDGET */}
          <div className="px-3 pb-2 space-y-2">
            {!authenticated ? (
              <button 
                onClick={login}
                className="flex items-center justify-center gap-2.5 w-full py-3 bg-[#3b82f6] hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase transition-all shadow-[0_0_20px_rgba(59,130,246,0.15)]"
              >
                <Wallet size={14} />
                <span>Connect Wallet</span>
              </button>
            ) : (
              <div className="bg-gradient-to-br from-[#3b82f6]/10 to-transparent rounded-2xl border border-[#3b82f6]/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-full bg-[#3b82f6]/20 flex items-center justify-center shrink-0">
                      <User size={12} className="text-[#3b82f6]" />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-300 truncate">{truncate(walletAddress || '')}</span>
                  </div>
                  <button onClick={logout} className="text-slate-600 hover:text-red-400 transition-colors">
                    <LogOut size={12} />
                  </button>
                </div>
                
                <div className="h-px bg-[#3b82f6]/10 w-full" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🪲</span>
                    <span className="text-[10px] font-black text-[#3b82f6] uppercase tracking-tighter">Scarab Pool</span>
                  </div>
                  <span className="text-xs font-black text-white">{scarab?.balance ?? '0'}</span>
                </div>
                
                <Link 
                  href="/dashboard"
                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 border border-[#3b82f6]/20 text-[#3b82f6] rounded-lg text-[9px] font-bold uppercase transition-all"
                >
                  <Flame size={10} />
                  <span>Claim Rewards</span>
                </Link>
              </div>
            )}
          </div>

          {/* BOTTOM LINKS */}
          <div className="px-6 py-4 border-t border-[#1e2035]/50 flex flex-col gap-3">
            <Link
              href="/docs"
              className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500 hover:text-white transition-colors group"
            >
              <FileText size={14} className="text-slate-600 group-hover:text-[#3b82f6] transition-colors" />
              <span className="uppercase tracking-widest font-mono">API Docs</span>
            </Link>
            <a
              href="https://github.com/JhiNResH/maiat-protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-[11px] font-bold text-slate-500 hover:text-white transition-colors group"
            >
              <Github size={14} className="text-slate-600 group-hover:text-white transition-colors" />
              <span className="uppercase tracking-widest font-mono">GitHub</span>
            </a>
          </div>

          <p className="px-6 pb-6 text-[9px] text-[#2a2d45] font-mono uppercase tracking-tighter">
            Maiat Protocol v1.2
          </p>
        </div>
      </aside>
    </>
  );
}

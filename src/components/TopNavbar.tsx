'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Sun, Moon, Wallet, LogOut, User, Flame } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import useSWR from 'swr';

const navLinks = [
  { name: 'Verify', href: '/' },
  { name: 'Markets', href: '/markets' },
  { name: 'Leaderboard', href: '/leaderboard' },
  { name: 'Analytics', href: '/analytics' },
  { name: 'Passport', href: '/passport' },
  { name: 'Docs', href: '/docs' },
];

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── macOS Dock magnification effect (matches passport-ens exactly) ───────────

function NavDock({ pathname, isDark }: { pathname: string; isDark: boolean }) {
  const mouseX = useMotionValue(-Infinity);

  return (
    <motion.div
      className="hidden md:flex items-center gap-0.5"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(-Infinity)}
    >
      {navLinks.map((link) => (
        <DockItem
          key={link.name}
          link={link}
          mouseX={mouseX}
          isDark={isDark}
          isActive={pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))}
        />
      ))}
    </motion.div>
  );
}

function DockItem({
  link,
  mouseX,
  isDark,
  isActive,
}: {
  link: { name: string; href: string };
  mouseX: ReturnType<typeof useMotionValue<number>>;
  isDark: boolean;
  isActive: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const distance = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const scale = useTransform(distance, [-120, 0, 120], [1, 1.35, 1]);
  const springScale = useSpring(scale, { mass: 0.1, stiffness: 200, damping: 12 });

  return (
    <Link ref={ref} href={link.href} className="relative">
      <motion.div style={{ scale: springScale }} className="px-5 py-2 rounded-full">
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.15em] transition-colors ${
            isActive
              ? isDark ? 'text-white' : 'text-black'
              : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-black'
          }`}
        >
          {link.name}
        </span>
      </motion.div>
    </Link>
  );
}

// ─── Main Navbar (structure matches passport-ens exactly) ─────────────────────

export default function TopNavbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setNavVisible(currentY < 50 || currentY < lastScrollY.current);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const externalWallet = wallets.find((w) => w.walletClientType !== 'privy');
  const walletAddress = externalWallet?.address ?? user?.wallet?.address;

  const { data: scarab } = useSWR(
    walletAddress ? `/api/v1/scarab?address=${walletAddress}` : null,
    fetcher
  );
  const { data: scarabStatus } = useSWR(
    walletAddress ? `/api/v1/scarab/status?address=${walletAddress}` : null,
    fetcher
  );

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <motion.nav
      initial={{ y: -100, x: '-50%', opacity: 0 }}
      animate={{ y: navVisible ? 0 : -100, x: '-50%', opacity: navVisible ? 1 : 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-6 left-1/2 z-50 w-[95%] max-w-5xl rounded-full px-6 py-3 flex items-center justify-between border transition-all duration-500 ${
        isDark
          ? 'bg-white/5 border-white/[0.08] shadow-[inset_0_0_30px_rgba(255,255,255,0.02),0_30px_100px_rgba(0,0,0,0.3)]'
          : 'bg-white/70 border-black/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.05)]'
      }`}
      style={{ backdropFilter: 'blur(60px) saturate(180%)', WebkitBackdropFilter: 'blur(60px) saturate(180%)' }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 group shrink-0">
        <Image
          src="/maiat-logo.jpg"
          alt="Maiat"
          width={28}
          height={28}
          className="w-7 h-7 rounded-full shadow-lg"
        />
        <span className={`font-mono font-bold text-base tracking-widest ${isDark ? 'text-white' : 'text-black'}`}>
          maiat
        </span>
      </Link>

      {/* Nav Links (desktop) — macOS Dock magnification */}
      <NavDock pathname={pathname} isDark={isDark} />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Scarab balance (when logged in) */}
        {authenticated && walletAddress && (
          <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
            isDark ? 'bg-white/10 border-white/10' : 'bg-black/5 border-black/5'
          }`}>
            <span className="text-sm">🪲</span>
            <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              {scarab?.balance ?? '0'}
            </span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
            isDark ? 'bg-white/10 border-white/10 text-yellow-400' : 'bg-black/5 border-black/5 text-gray-500'
          }`}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Wallet button */}
        {!authenticated ? (
          <button
            onClick={login}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all shadow-lg ${
              isDark ? 'bg-white text-black' : 'bg-black text-white'
            }`}
          >
            <Wallet size={13} />
            <span className="hidden sm:inline">Connect</span>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold transition-all border ${
                isDark ? 'bg-white/10 border-white/10 text-white' : 'bg-black/5 border-black/5 text-black'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <User size={10} className="text-emerald-500" />
              </div>
              <span className="hidden sm:inline font-mono">{truncate(walletAddress || '')}</span>
            </button>

            {menuOpen && (
              <div className={`absolute right-0 top-12 rounded-2xl p-3 min-w-[180px] space-y-2 border ${
                isDark
                  ? 'bg-black/90 border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.5)]'
                  : 'bg-white/90 border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.1)]'
              }`} style={{ backdropFilter: 'blur(40px)' }}>
                {/* Scarab claim */}
                {scarabStatus?.claimedToday ? (
                  <Link
                    href="/passport"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20"
                  >
                    <span>✓ Scarab Claimed</span>
                  </Link>
                ) : (
                  <Link
                    href="/passport"
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold transition-colors border ${
                      isDark ? 'text-white border-white/10 hover:bg-white/5' : 'text-black border-black/5 hover:bg-black/5'
                    }`}
                  >
                    <Flame size={12} className="text-amber-500" />
                    <span>Claim Scarab</span>
                  </Link>
                )}
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold transition-colors ${
                    isDark ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/5' : 'text-gray-500 hover:text-red-400 hover:bg-red-500/5'
                  }`}
                >
                  <LogOut size={12} />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.nav>
  );
}

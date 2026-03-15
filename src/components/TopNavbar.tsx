'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Sun, Moon, Wallet, LogOut, User, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
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

// ─── macOS Dock magnification effect ──────────────────────────────────────────

function NavDock({ pathname }: { pathname: string }) {
  const mouseX = useMotionValue(-Infinity);

  return (
    <motion.div
      className="hidden md:flex items-center gap-0.5 px-2 py-1 rounded-full"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(-Infinity)}
    >
      {navLinks.map((link) => (
        <DockItem
          key={link.name}
          link={link}
          mouseX={mouseX}
          isActive={pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))}
        />
      ))}
    </motion.div>
  );
}

function DockItem({
  link,
  mouseX,
  isActive,
}: {
  link: { name: string; href: string };
  mouseX: ReturnType<typeof useMotionValue<number>>;
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
      <motion.div
        style={{ scale: springScale }}
        className="px-4 py-2 rounded-full whitespace-nowrap relative"
      >
        {isActive && (
          <motion.div
            layoutId="nav-pill"
            className="absolute inset-0 bg-[var(--text-color)]/10 rounded-full"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <span
          className={cn(
            'relative z-10 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors',
            isActive
              ? 'text-[var(--text-color)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-color)]'
          )}
        >
          {link.name}
        </span>
      </motion.div>

    </Link>
  );
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────

export default function TopNavbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
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

  // Scarab balance
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
      className="fixed top-6 left-1/2 z-50 w-[95%] max-w-5xl"
    >
      <div className="liquid-glass px-6 py-3 flex items-center justify-between rounded-full">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <Image
              src="/maiat-logo.jpg"
              alt="Maiat"
              width={28}
              height={28}
              className="w-7 h-7 rounded-full shadow-lg"
            />
            <span className="font-mono font-bold text-base tracking-widest text-[var(--text-color)] uppercase">
              MAIAT
            </span>
          </Link>

          {/* Nav Links (desktop) — macOS Dock magnification */}
          <NavDock pathname={pathname} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Scarab balance (when logged in) */}
          {authenticated && walletAddress && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)]">
              <span className="text-sm">🪲</span>
              <span className="text-[10px] font-bold text-[var(--text-color)]">
                {scarab?.balance ?? '0'}
              </span>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Wallet button */}
          {!authenticated ? (
            <button
              onClick={login}
              className="flex items-center gap-2 bg-[var(--text-color)] text-[var(--bg-color)] px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all shadow-lg"
            >
              <Wallet size={13} />
              <span className="hidden sm:inline">Connect</span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 bg-[var(--card-bg)] border border-[var(--border-color)] px-4 py-2 rounded-full text-[10px] font-bold text-[var(--text-color)] hover:opacity-80 transition-all"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <User size={10} className="text-emerald-500" />
                </div>
                <span className="hidden sm:inline font-mono">{truncate(walletAddress || '')}</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 liquid-glass rounded-2xl p-3 min-w-[180px] space-y-2">
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
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold text-[var(--text-color)] hover:bg-[var(--card-bg)] transition-colors border border-[var(--border-color)]"
                    >
                      <Flame size={12} className="text-amber-500" />
                      <span>Claim Scarab</span>
                    </Link>
                  )}
                  <button
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-[10px] font-bold text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/5 transition-colors"
                  >
                    <LogOut size={12} />
                    <span>Disconnect</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

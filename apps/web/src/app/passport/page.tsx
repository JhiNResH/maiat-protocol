'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { ShieldCheck, Fingerprint, Activity, Search } from 'lucide-react'

export default function PassportIndexPage() {
  const router = useRouter()
  const { authenticated, user, login } = usePrivy()
  const { wallets } = useWallets()
  const externalWallet = wallets.find((w) => w.walletClientType !== 'privy')
  const [manualAddr, setManualAddr] = useState('')
  const [error, setError] = useState('')

  // Auto-redirect if wallet is already connected
  useEffect(() => {
    const addr = externalWallet?.address ?? user?.wallet?.address
    if (authenticated && addr) {
      router.push(`/passport/${addr}`)
    }
  }, [authenticated, user, externalWallet, router])

  const handleLookup = () => {
    const val = manualAddr.trim()
    if (/^0x[a-fA-F0-9]{40}$/.test(val)) {
      router.push(`/passport/${val}`)
    } else {
      setError('Enter a valid 0x wallet address')
    }
  }

  return (
    <div className="min-h-screen pb-20 relative">
      <main className="max-w-6xl mx-auto px-6 relative">
        {/* Hero */}
        <section className="text-center mb-12 sm:mb-24 pt-6 sm:pt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-3 bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] px-6 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase mb-12"
          >
            <span className="w-2 h-2 bg-[var(--text-color)] rounded-full animate-pulse" />
            Live on Mainnet
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="atmosphere-text font-black text-[var(--text-color)]"
          >
            Your <br />
            <span className="text-[var(--text-muted)]">Identity</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="text-[var(--text-secondary)] text-2xl max-w-2xl mx-auto mb-16 font-medium mt-8"
          >
            The decentralized standard for digital reputation and Sybil resistance. One passport, infinite access.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={login}
            className="bg-[var(--text-color)] text-[var(--bg-color)] px-8 sm:px-12 py-4 sm:py-5 rounded-2xl font-bold shadow-xl shadow-black/5 hover:opacity-90 transition-all flex items-center gap-4 mx-auto uppercase tracking-widest text-[10px] w-full sm:w-auto justify-center"
          >
            <ShieldCheck size={20} />
            Connect Wallet to View Passport
          </motion.button>
        </section>

        {/* Bento Grid Preview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-12 items-stretch">
          {/* Recent Reviews */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] border-white/40 p-6 sm:p-12 flex flex-col items-center justify-center text-center min-h-[280px] sm:min-h-[400px] hover-lift"
          >
            <div className="w-24 h-24 bg-[var(--card-bg)] rounded-[2rem] flex items-center justify-center text-[var(--text-muted)] mb-10">
              <Activity size={48} />
            </div>
            <h3 className="text-xl sm:text-3xl font-bold mb-4 text-[var(--text-color)]">Recent Reviews</h3>
            <p className="text-[var(--text-secondary)] font-medium">
              Connect your wallet to see your review history.
            </p>
          </motion.div>

          {/* Main Passport Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] border-white/40 p-6 sm:p-12 flex flex-col items-center justify-center text-center min-h-[320px] sm:min-h-[450px] relative overflow-hidden group hover-lift"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-[var(--text-color)]" />
            <div className="w-24 h-24 bg-[var(--card-bg)] rounded-full flex items-center justify-center text-[var(--text-color)] mb-10 group-hover:bg-[var(--text-color)] group-hover:text-[var(--bg-color)] transition-all">
              <Fingerprint size={48} />
            </div>
            <h2 className="text-4xl sm:text-6xl font-bold mb-6 text-[var(--text-color)] tracking-tighter leading-none">
              Your<br />Passport
            </h2>
            <p className="text-[var(--text-secondary)] mb-12 font-medium">
              Connect wallet to generate your unique reputation score.
            </p>
            <button
              onClick={login}
              className="bg-[var(--text-color)] text-[var(--bg-color)] px-10 py-4 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-black/5"
            >
              Connect Wallet to Generate
            </button>
          </motion.div>

          {/* Activity Heatmap */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="liquid-glass rounded-[1.5rem] sm:rounded-[3rem] border-white/40 p-6 sm:p-12 flex flex-col items-center justify-center text-center min-h-[280px] sm:min-h-[400px] hover-lift"
          >
            <div className="grid grid-cols-7 gap-1.5 sm:gap-3 mb-10">
              {Array.from({ length: 28 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-5 h-5 sm:w-7 sm:h-7 rounded-lg transition-colors ${
                    i % 5 === 0 ? 'bg-[var(--text-color)]' :
                    i % 3 === 0 ? 'bg-[var(--text-secondary)]' :
                    i % 2 === 0 ? 'bg-[var(--text-muted)]' : 'bg-[var(--card-bg)]'
                  }`}
                />
              ))}
            </div>
            <h3 className="text-xl sm:text-3xl font-bold mb-4 text-[var(--text-color)]">Activity Heatmap</h3>
            <p className="text-[var(--text-secondary)] font-medium">Start contributing to build your map</p>
          </motion.div>
        </div>

        {/* Manual Lookup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-16 text-center"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">
            Or look up any address
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="0x... wallet address"
                value={manualAddr}
                onChange={(e) => { setManualAddr(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                className="w-full liquid-glass rounded-2xl pl-12 pr-6 py-4 text-sm text-[var(--text-color)] placeholder:text-[var(--text-muted)] outline-none focus:ring-2 focus:ring-[var(--text-color)]/5 transition-all"
              />
            </div>
            <button
              onClick={handleLookup}
              className="bg-[var(--text-color)] text-[var(--bg-color)] px-8 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shrink-0"
            >
              Look Up
            </button>
          </div>
          {error && (
            <p className="mt-3 text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">{error}</p>
          )}
        </motion.div>
      </main>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { ShieldCheck, Search, Wallet, ArrowRight } from 'lucide-react'
import MeshBackground from '@/components/MeshBackground'
import { Footer } from '@/components/Footer'
import { cn } from '@/lib/utils'

export default function PassportIndexPage() {
  const router = useRouter()
  const { authenticated, user, login } = usePrivy()
  const { wallets } = useWallets()
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy')
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
      <MeshBackground />

      <main className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <section className="text-center mb-20 pt-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--text-color)] text-[var(--bg-color)] text-[10px] font-black uppercase tracking-[0.2em] mb-10 mx-auto"
          >
            <ShieldCheck size={14} />
            <span>Trust Passport</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-6xl font-black text-[var(--text-color)] tracking-tight mb-6"
          >
            Your On-Chain Identity
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-[var(--text-secondary)] text-xl max-w-xl mx-auto font-medium"
          >
            Reputation score, review history, and trust level in the Maiat network.
          </motion.p>
        </section>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Connect Wallet Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="liquid-glass p-10 rounded-[2.5rem] hover-lift text-center"
          >
            <div className="w-16 h-16 bg-[var(--text-color)] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Wallet size={28} className="text-[var(--bg-color)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-color)] mb-3">View Your Passport</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">
              Connect your wallet to view your full trust passport and reputation score.
            </p>
            <button
              onClick={login}
              className="w-full bg-[var(--text-color)] text-[var(--bg-color)] py-4 rounded-2xl font-bold text-sm hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-3"
            >
              <Wallet size={16} />
              Connect Wallet
            </button>
          </motion.div>

          {/* Manual Lookup Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="liquid-glass p-10 rounded-[2.5rem] hover-lift"
          >
            <div className="w-16 h-16 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search size={28} className="text-[var(--text-secondary)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-color)] mb-3">Look Up Any Wallet</h2>
            <p className="text-[var(--text-secondary)] text-sm mb-8 leading-relaxed">
              Enter any wallet address to view their public trust passport.
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualAddr}
                  onChange={e => { setManualAddr(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                  placeholder="0x wallet address…"
                  className="flex-1 bg-[var(--card-bg)] border border-[var(--border-color)] focus:border-[var(--text-color)] text-[var(--text-color)] font-mono text-sm px-4 py-3 rounded-2xl outline-none transition-colors placeholder:text-[var(--text-muted)]"
                />
                <button
                  onClick={handleLookup}
                  className="bg-[var(--text-color)] text-[var(--bg-color)] px-5 py-3 rounded-2xl font-bold transition-all hover:opacity-90 flex items-center"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
              {error && <p className="text-rose-400 text-xs font-mono">{error}</p>}
            </div>
          </motion.div>
        </div>

        {/* Info bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-8">
          {[
            { label: 'Trust Score', desc: 'Based on on-chain behavior' },
            { label: 'Review History', desc: 'Community attestations' },
            { label: 'EAS Receipts', desc: 'On-chain verifications' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-[2rem] bg-[var(--card-bg)] border border-[var(--border-color)] text-center"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-2">{item.label}</p>
              <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}

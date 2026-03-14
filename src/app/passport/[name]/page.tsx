'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { Header } from '@/components/Header'
import Link from 'next/link'
import { Shield, Copy, Check, ExternalLink, Globe, Zap, Twitter } from 'lucide-react'

interface PassportData {
  id: string
  ensName: string
  ensFullName: string
  walletAddress: string | null
  ownerAddress: string | null
  name: string | null
  description: string | null
  type: string
  status: string
  trustScore: number
  verdict: string
  scarabBalance: number
  totalQueries: number
  totalOutcomes: number
  streakDays: number
  erc8004Id: string | null
  acpAgentId: string | null
  referralCode: string
  passportUrl: string
  claimUrl: string
  createdAt: string
}

function fmt(addr?: string | null) {
  if (!addr) return '—'
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

const verdictConfig: Record<string, { label: string; color: string; bg: string }> = {
  trusted: { label: 'TRUSTED', color: '#34D399', bg: '#34D39915' },
  proceed: { label: 'PROCEED', color: '#3B82F6', bg: '#3B82F615' },
  caution: { label: 'CAUTION', color: '#FBBF24', bg: '#FBBF2415' },
  avoid:   { label: 'AVOID',   color: '#EF4444', bg: '#EF444415' },
}

export default function PassportDetailPage() {
  const params = useParams()
  const nameParam = params?.name as string
  const { user } = usePrivy()
  const { wallets } = useWallets()
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy')

  const [passport, setPassport] = useState<PassportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const isOwner = passport && (
    (externalWallet?.address ?? user?.wallet?.address)?.toLowerCase() === passport.walletAddress?.toLowerCase() ||
    (externalWallet?.address ?? user?.wallet?.address)?.toLowerCase() === passport.ownerAddress?.toLowerCase()
  )

  useEffect(() => {
    if (!nameParam) return
    setLoading(true)

    // Try lookup by ENS name first, then by wallet address
    const q = nameParam.startsWith('0x') ? nameParam : nameParam.replace(/\.maiat\.eth$/, '')

    fetch(`/api/v1/passport/lookup?q=${encodeURIComponent(q)}`)
      .then(r => {
        if (r.status === 404) {
          setNotFound(true)
          return null
        }
        return r.json()
      })
      .then(data => {
        if (data?.passport) setPassport(data.passport)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [nameParam])

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="font-mono text-gray-500 text-xs animate-pulse">// RESOLVING PASSPORT…</p>
        </main>
      </div>
    )
  }

  if (notFound || !passport) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="font-mono text-gray-400 text-sm">
            {nameParam}.maiat.eth — not found
          </p>
          <Link
            href="/passport"
            className="font-mono text-[#3b82f6] text-xs hover:underline"
          >
            ← Register this name
          </Link>
        </main>
      </div>
    )
  }

  const vc = verdictConfig[passport.verdict] || verdictConfig.caution
  const trustPct = Math.min(100, passport.trustScore)

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
      <Header />

      <main className="flex-1 pt-8 px-4 pb-16">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* ── Hero Card ──────────────────────────────────────────── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 relative overflow-hidden">

            {/* Top: Type badge + Owner badge */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{passport.type === 'agent' ? '🤖' : '👤'}</span>
                <div>
                  <h1 className="text-white font-mono font-bold text-xl">
                    {passport.name || passport.ensName}
                  </h1>
                  <p className="text-gray-500 font-mono text-xs">{passport.ensFullName}</p>
                </div>
              </div>
              <span
                className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg"
                style={{ color: vc.color, backgroundColor: vc.bg, border: `1px solid ${vc.color}30` }}
              >
                {vc.label}
              </span>
            </div>

            {/* Trust Score Bar */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold tracking-widest uppercase font-mono text-gray-500">
                  TRUST SCORE
                </span>
                <span className="text-sm font-bold font-mono" style={{ color: vc.color }}>
                  {passport.trustScore}/100
                </span>
              </div>
              <div className="w-full bg-[var(--bg-page)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${trustPct}%`,
                    backgroundColor: vc.color,
                    boxShadow: `0 0 12px ${vc.color}44`,
                  }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Queries" value={passport.totalQueries.toLocaleString()} />
              <Stat label="Outcomes" value={passport.totalOutcomes.toLocaleString()} />
              <Stat label="Streak" value={`${passport.streakDays}d`} icon="🔥" />
              <Stat label="Scarab" value={passport.scarabBalance.toLocaleString()} icon="🪲" />
            </div>
          </div>

          {/* ── Identity & Verification ────────────────────────── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase font-mono text-gray-500 mb-4">
              // VERIFIED IDENTITY
            </p>
            <div className="space-y-3">
              <IdRow
                icon={<Globe className="w-3.5 h-3.5" />}
                label="ENS"
                value={passport.ensFullName}
                verified
                onCopy={() => handleCopy(passport.ensFullName, 'ens')}
                copied={copied === 'ens'}
              />
              {passport.walletAddress && (
                <IdRow
                  icon={<Shield className="w-3.5 h-3.5" />}
                  label="Wallet"
                  value={fmt(passport.walletAddress)}
                  fullValue={passport.walletAddress}
                  verified
                  onCopy={() => handleCopy(passport.walletAddress!, 'wallet')}
                  copied={copied === 'wallet'}
                  link={`https://basescan.org/address/${passport.walletAddress}`}
                />
              )}
              {passport.ownerAddress && (
                <IdRow
                  icon={<Check className="w-3.5 h-3.5" />}
                  label="Owner"
                  value={fmt(passport.ownerAddress)}
                  fullValue={passport.ownerAddress}
                  verified={passport.status === 'claimed' || passport.status === 'active'}
                  onCopy={() => handleCopy(passport.ownerAddress!, 'owner')}
                  copied={copied === 'owner'}
                />
              )}
              {passport.erc8004Id && (
                <IdRow
                  icon={<Shield className="w-3.5 h-3.5" />}
                  label="ERC-8004"
                  value={`#${passport.erc8004Id}`}
                  verified
                />
              )}
              {passport.acpAgentId && (
                <IdRow
                  icon={<Zap className="w-3.5 h-3.5" />}
                  label="ACP Agent"
                  value={`#${passport.acpAgentId}`}
                  verified
                  link={`https://app.virtuals.io/agents/${passport.acpAgentId}`}
                />
              )}
            </div>
          </div>

          {/* ── API Lookup ──────────────────────────────────────── */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
            <p className="text-[10px] font-bold tracking-widest uppercase font-mono text-gray-500 mb-3">
              // RESOLVE VIA API
            </p>
            <div className="bg-[var(--bg-page)] rounded-lg p-3 font-mono text-[10px] text-gray-400 overflow-x-auto">
              <span className="text-emerald-400">GET</span>{' '}
              <span className="text-white">/api/v1/passport/lookup?q={passport.ensName}</span><br />
              <span className="text-gray-600">// or resolve ENS:</span>{' '}
              <span className="text-amber-400">{passport.ensFullName}</span>
            </div>
          </div>

          {/* ── Actions ────────────────────────────────────────── */}
          <div className="flex gap-3">
            {passport.status === 'unclaimed' && (
              <Link
                href={passport.claimUrl.replace('https://app.maiat.io', '')}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-mono font-bold text-sm py-3 rounded-xl transition-colors text-center"
              >
                Claim This Passport
              </Link>
            )}
            <button
              onClick={() => handleCopy(window.location.href, 'share')}
              className="flex-1 border border-[var(--border-default)] hover:border-[#3b82f6] text-white font-mono text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {copied === 'share' ? (
                <><Check className="w-3 h-3" /> Copied</>
              ) : (
                <><Copy className="w-3 h-3" /> Share</>
              )}
            </button>
          </div>

          {/* ── Referral ───────────────────────────────────────── */}
          {isOwner && (
            <div className="bg-[var(--bg-surface)] border border-amber-500/20 rounded-xl p-5">
              <p className="text-[10px] font-bold tracking-widest uppercase font-mono text-amber-400 mb-2">
                // REFER & EARN
              </p>
              <p className="text-gray-500 font-mono text-[10px] mb-3">
                Share your referral link. Earn 25 🪲 per signup + 10% of their outcomes for 30 days.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`app.maiat.io/claim/${passport.referralCode}`}
                  className="flex-1 bg-[var(--bg-page)] border border-[var(--border-default)] text-white font-mono text-[10px] px-3 py-2 rounded-lg"
                />
                <button
                  onClick={() => handleCopy(`https://app.maiat.io/claim/${passport.referralCode}`, 'referral')}
                  className="text-[10px] font-mono text-[#3b82f6] hover:text-white px-3 py-2 border border-[var(--border-default)] rounded-lg transition-colors"
                >
                  {copied === 'referral' ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="bg-[var(--bg-page)] rounded-lg p-3 text-center">
      <p className="text-[9px] font-bold tracking-widest uppercase font-mono text-gray-600 mb-1">{label}</p>
      <p className="text-lg font-bold font-mono text-white">
        {icon && <span className="text-sm mr-0.5">{icon}</span>}
        {value}
      </p>
    </div>
  )
}

function IdRow({
  icon, label, value, fullValue, verified, onCopy, copied, link,
}: {
  icon: React.ReactNode
  label: string
  value: string
  fullValue?: string
  verified?: boolean
  onCopy?: () => void
  copied?: boolean
  link?: string
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--border-default)] last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-gray-600">{icon}</span>
        <span className="text-gray-500 font-mono text-[10px] uppercase w-16">{label}</span>
        {verified ? (
          <Check className="w-3 h-3 text-emerald-400" />
        ) : (
          <span className="w-3 h-3 rounded-full border border-gray-700 inline-block" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-white font-mono text-xs" title={fullValue}>
          {value}
        </span>
        {onCopy && (
          <button onClick={onCopy} className="text-gray-600 hover:text-white transition-colors">
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-[#3b82f6]">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

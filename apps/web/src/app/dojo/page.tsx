'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { createPublicClient, createWalletClient, http, custom, formatEther, parseEther, defineChain } from 'viem'
import { ShoppingCart, Check, Zap, Users, Coins } from 'lucide-react'
import {
  CONTRACTS, SKILL_REGISTRY_ABI, SKILL_ICONS,
} from '@/lib/xlayer-contracts'

const xlayerTestnet = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech/terigon'] } },
  blockExplorers: { default: { name: 'OKX Explorer', url: 'https://www.okx.com/web3/explorer/xlayer-test' } },
})

const publicClient = createPublicClient({ chain: xlayerTestnet, transport: http() })

interface Skill {
  id: number
  creator: string
  name: string
  description: string
  price: bigint
  royaltyBps: number
  totalBuyers: number
  owned: boolean
}

export default function DojoPage() {
  const { authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets?.[0]
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<number | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const loadSkills = useCallback(async () => {
    try {
      setLoading(true)
      const nextId = await publicClient.readContract({
        address: CONTRACTS.skillRegistry as `0x${string}`,
        abi: SKILL_REGISTRY_ABI,
        functionName: 'nextSkillId',
      }) as bigint

      const count = Number(nextId)
      const loaded: Skill[] = []

      for (let i = 1; i < count; i++) {
        try {
          const data = await publicClient.readContract({
            address: CONTRACTS.skillRegistry as `0x${string}`,
            abi: SKILL_REGISTRY_ABI,
            functionName: 'getSkill',
            args: [BigInt(i)],
          }) as [string, string, string, bigint, number, bigint]

          let owned = false
          if (wallet?.address) {
            owned = await publicClient.readContract({
              address: CONTRACTS.skillRegistry as `0x${string}`,
              abi: SKILL_REGISTRY_ABI,
              functionName: 'hasSkill',
              args: [wallet.address as `0x${string}`, BigInt(i)],
            }) as boolean
          }

          loaded.push({
            id: i,
            creator: data[0],
            name: data[1],
            description: data[2],
            price: data[3],
            royaltyBps: Number(data[4]),
            totalBuyers: Number(data[5]),
            owned,
          })
        } catch { /* skip invalid */ }
      }
      setSkills(loaded)
    } catch (err) {
      console.error('Failed to load skills:', err)
    } finally {
      setLoading(false)
    }
  }, [wallet?.address])

  useEffect(() => {
    if (CONTRACTS.skillRegistry !== '0x0000000000000000000000000000000000000000') {
      loadSkills()
    } else {
      setLoading(false)
    }
  }, [loadSkills])

  const buySkill = async (skillId: number, price: bigint) => {
    if (!wallet) return
    setBuying(skillId)
    setTxHash(null)
    try {
      const provider = await wallet.getEthereumProvider()
      const wc = createWalletClient({ chain: xlayerTestnet, transport: custom(provider) })
      const [account] = await wc.getAddresses()
      const hash = await wc.writeContract({
        address: CONTRACTS.skillRegistry as `0x${string}`,
        abi: SKILL_REGISTRY_ABI,
        functionName: 'buySkill',
        args: [BigInt(skillId)],
        value: price,
        account,
      })
      setTxHash(hash)
      await publicClient.waitForTransactionReceipt({ hash })
      await loadSkills()
    } catch (err) {
      console.error('Buy failed:', err)
    } finally {
      setBuying(null)
    }
  }

  const ownedSkills = skills.filter(s => s.owned)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
          🥋 Dojo — Skill Marketplace
        </h1>
        <p className="text-white/60 text-lg">
          Acquire skills to become a better autonomous worker. Creators earn royalties.
        </p>
      </motion.div>

      {/* My Skills */}
      {ownedSkills.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-10">
          <h2 className="text-xl font-semibold mb-4 text-white/80">🎒 My Skills</h2>
          <div className="flex flex-wrap gap-3">
            {ownedSkills.map(s => (
              <div key={s.id} className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2 text-sm">
                <span>{SKILL_ICONS[s.id] || '🔮'}</span>
                <span className="text-green-400 font-medium">{s.name}</span>
                <Check className="w-4 h-4 text-green-400" />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tx success */}
      {txHash && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-green-400 text-sm">✅ Skill purchased! TX: <a href={`https://www.okx.com/web3/explorer/xlayer-test/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">{txHash.slice(0, 16)}...</a></p>
        </motion.div>
      )}

      {/* Connect prompt */}
      {!authenticated && (
        <div className="text-center py-20">
          <p className="text-white/50 mb-4">Connect your wallet to browse and buy skills</p>
          <button onClick={login} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-medium transition-all">
            Connect Wallet
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
              <div className="h-12 w-12 bg-white/10 rounded-xl mb-4" />
              <div className="h-5 bg-white/10 rounded w-2/3 mb-2" />
              <div className="h-4 bg-white/10 rounded w-full mb-4" />
              <div className="h-10 bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Skills grid */}
      {!loading && skills.length === 0 && authenticated && (
        <div className="text-center py-20 text-white/40">
          <p className="text-lg">No skills deployed yet.</p>
          <p className="text-sm mt-2">Deploy contracts and seed skills first.</p>
        </div>
      )}

      {!loading && skills.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill, idx) => (
            <motion.div
              key={skill.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all group"
            >
              {/* Icon + Name */}
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{SKILL_ICONS[skill.id] || '🔮'}</div>
                {skill.owned && (
                  <span className="bg-green-500/20 text-green-400 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Owned
                  </span>
                )}
              </div>

              <h3 className="text-xl font-semibold text-white mb-2">{skill.name}</h3>
              <p className="text-white/50 text-sm mb-4 line-clamp-2">{skill.description}</p>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-sm text-white/40">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{skill.totalBuyers} users</span>
                </div>
                <div className="flex items-center gap-1">
                  <Coins className="w-4 h-4" />
                  <span>{skill.royaltyBps / 100}% royalty</span>
                </div>
              </div>

              {/* Creator */}
              <div className="text-xs text-white/30 mb-4">
                by {skill.creator.slice(0, 6)}...{skill.creator.slice(-4)}
              </div>

              {/* Price + Buy */}
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-white">
                  {formatEther(skill.price)} OKB
                </div>
                {skill.owned ? (
                  <div className="px-4 py-2 bg-green-500/10 text-green-400 rounded-xl text-sm font-medium flex items-center gap-1">
                    <Check className="w-4 h-4" /> Acquired
                  </div>
                ) : (
                  <button
                    onClick={() => buySkill(skill.id, skill.price)}
                    disabled={buying === skill.id}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {buying === skill.id ? (
                      <><Zap className="w-4 h-4 animate-spin" /> Buying...</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4" /> Buy Skill</>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-center gap-4 mt-12">
        <a href="/jobs" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/70 hover:text-white">
          → Go to Job Board
        </a>
        <a href="/reputation" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/70 hover:text-white">
          → Check Reputation
        </a>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { motion } from 'framer-motion'
import { createPublicClient, createWalletClient, http, custom, formatEther, parseEther, defineChain } from 'viem'
import { Briefcase, Star, Send, CheckCircle, Clock, XCircle } from 'lucide-react'
import {
  CONTRACTS, JOB_MARKET_ABI, SKILL_REGISTRY_ABI, SKILL_ICONS,
  JOB_STATUS_LABELS, JOB_STATUS_COLORS,
} from '@/lib/xlayer-contracts'

const xlayerTestnet = defineChain({
  id: 1952,
  name: 'X Layer Testnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: { default: { http: ['https://testrpc.xlayer.tech/terigon'] } },
  blockExplorers: { default: { name: 'OKX Explorer', url: 'https://www.okx.com/web3/explorer/xlayer-test' } },
})

const publicClient = createPublicClient({ chain: xlayerTestnet, transport: http() })

interface Job {
  id: number
  buyer: string
  worker: string
  description: string
  reward: bigint
  preferredSkillId: number
  status: number
  rating: number
  createdAt: number
  skillName?: string
}

export default function JobsPage() {
  const { authenticated, login } = usePrivy()
  const { wallets } = useWallets()
  const wallet = wallets?.[0]

  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Form state
  const [desc, setDesc] = useState('')
  const [reward, setReward] = useState('')
  const [skillId, setSkillId] = useState('0')
  const [ratingInput, setRatingInput] = useState<Record<number, number>>({})

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true)
      const nextId = await publicClient.readContract({
        address: CONTRACTS.jobMarket as `0x${string}`,
        abi: JOB_MARKET_ABI,
        functionName: 'nextJobId',
      }) as bigint

      const count = Number(nextId)
      const loaded: Job[] = []

      for (let i = 1; i < count; i++) {
        try {
          const data = await publicClient.readContract({
            address: CONTRACTS.jobMarket as `0x${string}`,
            abi: JOB_MARKET_ABI,
            functionName: 'getJob',
            args: [BigInt(i)],
          }) as [string, string, string, bigint, bigint, number, number, bigint]

          let skillName = ''
          const sid = Number(data[4])
          if (sid > 0) {
            try {
              const sk = await publicClient.readContract({
                address: CONTRACTS.skillRegistry as `0x${string}`,
                abi: SKILL_REGISTRY_ABI,
                functionName: 'getSkill',
                args: [BigInt(sid)],
              }) as [string, string, string, bigint, number, bigint]
              skillName = sk[1]
            } catch { /* skip */ }
          }

          loaded.push({
            id: i,
            buyer: data[0],
            worker: data[1],
            description: data[2],
            reward: data[3],
            preferredSkillId: sid,
            status: Number(data[5]),
            rating: Number(data[6]),
            createdAt: Number(data[7]),
            skillName,
          })
        } catch { /* skip */ }
      }
      setJobs(loaded.reverse()) // newest first
    } catch (err) {
      console.error('Failed to load jobs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (CONTRACTS.jobMarket !== '0x0000000000000000000000000000000000000000') {
      loadJobs()
    } else {
      setLoading(false)
    }
  }, [loadJobs])

  const getWalletClient = async () => {
    if (!wallet) throw new Error('No wallet')
    const provider = await wallet.getEthereumProvider()
    return createWalletClient({ chain: xlayerTestnet, transport: custom(provider) })
  }

  const postJob = async () => {
    if (!desc || !reward) return
    setPosting(true)
    try {
      const wc = await getWalletClient()
      const [account] = await wc.getAddresses()
      const hash = await wc.writeContract({
        address: CONTRACTS.jobMarket as `0x${string}`,
        abi: JOB_MARKET_ABI,
        functionName: 'postJob',
        args: [desc, BigInt(skillId)],
        value: parseEther(reward),
        account,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setDesc('')
      setReward('')
      setSkillId('0')
      await loadJobs()
    } catch (err) {
      console.error('Post job failed:', err)
    } finally {
      setPosting(false)
    }
  }

  const acceptJob = async (jobId: number) => {
    setActionLoading(jobId)
    try {
      const wc = await getWalletClient()
      const [account] = await wc.getAddresses()
      const hash = await wc.writeContract({
        address: CONTRACTS.jobMarket as `0x${string}`,
        abi: JOB_MARKET_ABI,
        functionName: 'acceptJob',
        args: [BigInt(jobId)],
        account,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      await loadJobs()
    } catch (err) {
      console.error('Accept failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const completeJob = async (jobId: number) => {
    setActionLoading(jobId)
    try {
      const wc = await getWalletClient()
      const [account] = await wc.getAddresses()
      const hash = await wc.writeContract({
        address: CONTRACTS.jobMarket as `0x${string}`,
        abi: JOB_MARKET_ABI,
        functionName: 'completeJob',
        args: [BigInt(jobId)],
        account,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      await loadJobs()
    } catch (err) {
      console.error('Complete failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const rateJob = async (jobId: number, score: number) => {
    setActionLoading(jobId)
    try {
      const wc = await getWalletClient()
      const [account] = await wc.getAddresses()
      const hash = await wc.writeContract({
        address: CONTRACTS.jobMarket as `0x${string}`,
        abi: JOB_MARKET_ABI,
        functionName: 'rateJob',
        args: [BigInt(jobId), score],
        account,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      await loadJobs()
    } catch (err) {
      console.error('Rate failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const addr = wallet?.address?.toLowerCase()

  const StatusIcon = ({ status }: { status: number }) => {
    switch (status) {
      case 0: return <Clock className="w-4 h-4 text-green-400" />
      case 1: return <Briefcase className="w-4 h-4 text-blue-400" />
      case 2: return <CheckCircle className="w-4 h-4 text-yellow-400" />
      case 3: return <Star className="w-4 h-4 text-purple-400" />
      case 4: return <XCircle className="w-4 h-4 text-red-400" />
      default: return null
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
          💼 Job Board
        </h1>
        <p className="text-white/60 text-lg">
          Post jobs for autonomous workers. Accept, complete, and rate.
        </p>
      </motion.div>

      {!authenticated && (
        <div className="text-center py-20">
          <p className="text-white/50 mb-4">Connect your wallet to post or accept jobs</p>
          <button onClick={login} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-medium">Connect Wallet</button>
        </div>
      )}

      {authenticated && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Post Job Form */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-28">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-400" /> Post a Job
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/50 mb-1 block">Description</label>
                  <textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="e.g. Deliver food from Restaurant A to Location B"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50 outline-none resize-none h-24"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/50 mb-1 block">Reward (OKB)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={reward}
                    onChange={e => setReward(e.target.value)}
                    placeholder="0.01"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/50 mb-1 block">Preferred Skill (optional)</label>
                  <select
                    value={skillId}
                    onChange={e => setSkillId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500/50 outline-none"
                  >
                    <option value="0">Any skill</option>
                    <option value="1">🍔 Food Delivery</option>
                    <option value="2">💱 DEX Swap Pro</option>
                    <option value="3">🚗 Ride Dispatch</option>
                    <option value="4">📈 Staking Optimizer</option>
                    <option value="5">💬 Customer Support</option>
                  </select>
                </div>

                <button
                  onClick={postJob}
                  disabled={posting || !desc || !reward}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-xl font-medium transition-all disabled:opacity-50"
                >
                  {posting ? 'Posting...' : 'Post Job'}
                </button>
              </div>
            </div>
          </motion.div>

          {/* Jobs List */}
          <div className="lg:col-span-2 space-y-4">
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
                    <div className="h-5 bg-white/10 rounded w-2/3 mb-3" />
                    <div className="h-4 bg-white/10 rounded w-1/3" />
                  </div>
                ))}
              </div>
            )}

            {!loading && jobs.length === 0 && (
              <div className="text-center py-20 text-white/40">
                <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No jobs posted yet. Be the first!</p>
              </div>
            )}

            {!loading && jobs.map((job, idx) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{job.preferredSkillId > 0 ? (SKILL_ICONS[job.preferredSkillId] || '🔮') : '📋'}</span>
                    <div>
                      <h3 className="text-lg font-medium text-white">{job.description}</h3>
                      <p className="text-xs text-white/30 mt-1">
                        by {job.buyer.slice(0, 6)}...{job.buyer.slice(-4)}
                        {job.skillName && <> · Prefers: {job.skillName}</>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-cyan-400">{formatEther(job.reward)} OKB</div>
                    <div className={`text-xs flex items-center gap-1 justify-end mt-1 ${JOB_STATUS_COLORS[job.status]}`}>
                      <StatusIcon status={job.status} />
                      {JOB_STATUS_LABELS[job.status]}
                    </div>
                  </div>
                </div>

                {/* Worker info */}
                {job.worker !== '0x0000000000000000000000000000000000000000' && (
                  <p className="text-xs text-white/30 mb-3">
                    Worker: {job.worker.slice(0, 6)}...{job.worker.slice(-4)}
                  </p>
                )}

                {/* Rating display */}
                {job.status === 3 && (
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-5 h-5 ${s <= job.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'}`} />
                    ))}
                    <span className="text-sm text-white/50 ml-2">{job.rating}/5</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-3">
                  {/* Accept: only if Open and not the buyer */}
                  {job.status === 0 && addr && job.buyer.toLowerCase() !== addr && (
                    <button
                      onClick={() => acceptJob(job.id)}
                      disabled={actionLoading === job.id}
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {actionLoading === job.id ? 'Accepting...' : '✋ Accept Job'}
                    </button>
                  )}

                  {/* Complete: only if InProgress and I'm the worker */}
                  {job.status === 1 && addr && job.worker.toLowerCase() === addr && (
                    <button
                      onClick={() => completeJob(job.id)}
                      disabled={actionLoading === job.id}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      {actionLoading === job.id ? 'Completing...' : '✅ Mark Complete'}
                    </button>
                  )}

                  {/* Rate: only if Completed and I'm the buyer */}
                  {job.status === 2 && addr && job.buyer.toLowerCase() === addr && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/50">Rate:</span>
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setRatingInput({ ...ratingInput, [job.id]: s })
                          }}
                          className="hover:scale-125 transition-transform"
                        >
                          <Star className={`w-6 h-6 ${(ratingInput[job.id] || 0) >= s ? 'text-yellow-400 fill-yellow-400' : 'text-white/20 hover:text-yellow-400/50'}`} />
                        </button>
                      ))}
                      {ratingInput[job.id] && (
                        <button
                          onClick={() => rateJob(job.id, ratingInput[job.id])}
                          disabled={actionLoading === job.id}
                          className="ml-2 px-3 py-1 bg-purple-500 rounded-lg text-sm disabled:opacity-50"
                        >
                          {actionLoading === job.id ? '...' : 'Submit'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-center gap-4 mt-12">
        <a href="/dojo" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/70 hover:text-white">
          ← Skill Marketplace
        </a>
        <a href="/reputation" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-white/70 hover:text-white">
          → Check Reputation
        </a>
      </div>
    </div>
  )
}

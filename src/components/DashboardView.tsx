'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { Shield, Coins, Activity, Zap, Star, ExternalLink, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

// Types
type PassportData = {
  trustLevel: string
  reputationScore: number
  totalReviews: number
  scarabBalance: number
  feeTier: string
  interactedContracts: number
  reviewedContracts: number
}

type InteractionData = {
  address: string
  name: string
  category: string
  trustScore: number | null
  userTxCount: number
  canReview: boolean
  existingReview: boolean
}

export function DashboardView() {
  const { ready, authenticated, user } = usePrivy()
  const router = useRouter()
  
  const [passport, setPassport] = useState<PassportData | null>(null)
  const [interactions, setInteractions] = useState<InteractionData[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<InteractionData | null>(null)

  // Review form state
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/')
      return
    }

    if (authenticated && user?.wallet?.address) {
      fetchDashboardData(user.wallet.address)
    }
  }, [ready, authenticated, user?.wallet?.address, router])

  async function fetchDashboardData(address: string) {
    setLoading(true)
    try {
      const [passportRes, interactionsRes] = await Promise.all([
        fetch(`/api/v1/wallet/${address}/passport`),
        fetch(`/api/v1/wallet/${address}/interactions`)
      ])

      if (passportRes.ok) {
        setPassport(await passportRes.json())
      }
      
      if (interactionsRes.ok) {
        const data = await interactionsRes.json()
        setInteractions(data.interactions || [])
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleOpenReview(contract: InteractionData) {
    if (!contract.canReview) {
      toast.error('You need more on-chain interactions to review this contract.')
      return
    }
    if (contract.existingReview) {
      toast.error('You have already reviewed this contract.')
      return
    }
    setSelectedContract(contract)
    setRating(5)
    setComment('')
    setReviewModalOpen(true)
  }

  async function submitReview() {
    if (!selectedContract || !user?.wallet?.address) return
    
    // Check Scarab balance
    if ((passport?.scarabBalance || 0) < 2) {
      toast.error('Insufficient Scarab. Reviews cost 2 🪲.')
      return
    }

    if (comment.length < 10) {
      toast.error('Review must be at least 10 characters long.')
      return
    }

    setSubmitting(true)
    try {
      // Step 1: Request signature for EIP-191 proof
      const message = `Maiat Review: ${selectedContract.address} Rating: ${rating} Nonce: ${Date.now()}`
      
      // We assume Privy provider is injected as window.ethereum for simple personal_sign
      // In a real app we'd use the useWallets hook from Privy to get the correct EIP1193 provider
      const provider = (window as any).ethereum
      let signature = ''
      
      try {
         signature = await provider.request({
           method: 'personal_sign',
           params: [message, user.wallet.address]
         })
      } catch (signErr) {
         toast.error('Signature rejected.')
         setSubmitting(false)
         return
      }

      // Step 2: Submit to API
      const res = await fetch('/api/v1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: selectedContract.address,
          reviewer: user.wallet.address,
          rating,
          comment,
          type: 'trust',
          signature,
          message
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit review')
      }

      toast.success(
        <div>
          Review submitted successfully!<br/>
          <span className="text-sm text-gold">Earned {data.rewardAmount} 🪲</span>
        </div>
      )
      
      setReviewModalOpen(false)
      // Refresh dashboard data
      fetchDashboardData(user.wallet.address)
      
    } catch (err: any) {
      toast.error(err.message || 'Error submitting review')
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready || !authenticated) {
    return (
      <div className="flex flex-col min-h-screen bg-page">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
        </div>
      </div>
    )
  }

  const shortAddress = user?.wallet?.address 
    ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}`
    : ''

  return (
    <div className="flex flex-col min-h-screen bg-page relative">
      <Header />

      <main className="flex-1 flex flex-col px-[60px] py-12 max-w-[1200px] mx-auto w-full gap-12">
        {/* Header Section */}
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-[32px] font-bold text-txt-primary">Reputation Passport</h1>
            <p className="text-txt-secondary font-mono text-sm">{shortAddress}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold" />
          </div>
        ) : (
          <>
            {/* Passport Cards */}
            <div className="grid grid-cols-4 gap-6">
              {/* Trust Level */}
              <div className="bg-surface border border-border-subtle rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald" />
                  <span className="text-sm font-medium text-txt-secondary">Trust Level</span>
                </div>
                <div className="text-[28px] font-bold text-txt-primary capitalize">
                  {passport?.trustLevel || 'Newcomer'}
                </div>
                <div className="text-xs text-txt-muted mt-auto pt-2 border-t border-border-subtle">
                  Unlocks {passport?.feeTier || 'Standard'} Swap Fees
                </div>
              </div>

              {/* Reputation */}
              <div className="bg-surface border border-border-subtle rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-turquoise" />
                  <span className="text-sm font-medium text-txt-secondary">Reputation Score</span>
                </div>
                <div className="text-[28px] font-bold text-txt-primary">
                  {passport?.reputationScore || 0}
                </div>
                <div className="text-xs text-txt-muted mt-auto pt-2 border-t border-border-subtle">
                  Based on {passport?.totalReviews || 0} valid reviews
                </div>
              </div>

              {/* Scarab Balance */}
              <div className="bg-surface border border-border-subtle rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-gold" />
                  <span className="text-sm font-medium text-txt-secondary">Scarab Balance</span>
                </div>
                <div className="text-[28px] font-bold text-gold">
                  {passport?.scarabBalance || 0} <span className="text-lg">🪲</span>
                </div>
                <div className="text-xs text-txt-muted mt-auto pt-2 border-t border-border-subtle">
                  Cost per review: <span className="text-gold">2 🪲</span>
                </div>
              </div>

               {/* Activity */}
               <div className="bg-surface border border-border-subtle rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span className="text-sm font-medium text-txt-secondary">On-Chain Activity</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-txt-muted">Interacted</span>
                    <span className="font-mono text-txt-primary">{passport?.interactedContracts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-txt-muted">Reviewed</span>
                    <span className="font-mono text-txt-primary">{passport?.reviewedContracts || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interaction Discovery */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-txt-primary">Contracts You Use</h2>
                <p className="text-sm text-txt-secondary">
                  We found these contracts based on your Base transaction history. Review them to earn reputation.
                </p>
              </div>

              {interactions.length === 0 ? (
                <div className="text-center py-12 bg-surface border border-border-subtle rounded-2xl">
                  <p className="text-txt-secondary">No contract interactions found on Base.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                  {interactions.map(contract => (
                    <div key={contract.address} className="bg-surface border border-border-subtle rounded-2xl p-5 flex flex-col gap-4 hover:border-gold/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-bg-primary border border-border-subtle flex items-center justify-center">
                            <span className="text-lg font-bold text-txt-primary">
                              {contract.name ? contract.name[0] : '?'}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <h3 className="text-base font-bold text-txt-primary">{contract.name || 'Unknown Contract'}</h3>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-txt-muted shrink-0">
                                {contract.address.slice(0,6)}...{contract.address.slice(-4)}
                              </span>
                              <a href={`https://basescan.org/address/${contract.address}`} target="_blank" rel="noopener noreferrer" className="text-txt-muted hover:text-turquoise">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="flex flex-col p-2 bg-bg-primary rounded-lg border border-border-subtle">
                           <span className="text-[10px] text-txt-muted uppercase tracking-wider">Score</span>
                           <span className="text-sm font-bold text-txt-primary">{contract.trustScore ? contract.trustScore.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div className="flex flex-col p-2 bg-bg-primary rounded-lg border border-border-subtle">
                           <span className="text-[10px] text-txt-muted uppercase tracking-wider">Your Txs</span>
                           <span className="text-sm font-bold text-turquoise">{contract.userTxCount}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenReview(contract)}
                        disabled={!contract.canReview || contract.existingReview || (passport?.scarabBalance || 0) < 2}
                        className={`mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all
                          ${contract.existingReview 
                            ? 'bg-border-subtle text-txt-muted cursor-not-allowed hidden' 
                            : !contract.canReview || (passport?.scarabBalance || 0) < 2
                                ? 'bg-bg-primary text-txt-muted border border-border-subtle cursor-not-allowed'
                                : 'bg-gold/10 text-gold border border-gold/30 hover:bg-gold hover:text-page'
                          }`}
                      >
                        {contract.existingReview ? (
                          'Reviewed'
                        ) : !contract.canReview ? (
                          'Need More Txs'
                        ) : (passport?.scarabBalance || 0) < 2 ? (
                          'Need 2 Scarab'
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4" />
                            Write Review <span className="opacity-70 text-xs ml-1 font-normal">(-2 🪲)</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Footer />

      {/* Review Modal */}
      {reviewModalOpen && selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-gold/30 rounded-2xl w-full max-w-[500px] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between bg-bg-primary">
              <h3 className="text-lg font-bold text-txt-primary flex items-center gap-2">
                <Star className="w-5 h-5 text-gold" />
                Review {selectedContract.name}
              </h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-txt-muted hover:text-txt-primary p-1">
                ✕
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              {/* Rating */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-txt-secondary">Trust Rating</label>
                <div className="flex items-center justify-between px-4 py-3 bg-bg-primary border border-border-subtle rounded-xl">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value))}
                    className="flex-1 mr-4 accent-gold"
                  />
                  <div className="w-8 h-8 rounded bg-gold/20 flex items-center justify-center border border-gold/40">
                    <span className="font-bold text-gold">{rating}</span>
                  </div>
                </div>
              </div>

              {/* Comment */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-txt-secondary">Your Experience</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share details about your interaction with this protocol..."
                  className="w-full h-[120px] bg-bg-primary border border-border-subtle rounded-xl p-4 text-sm text-txt-primary placeholder-txt-muted resize-none focus:outline-none focus:border-gold/50 transition-colors"
                />
              </div>

              {/* Notice */}
              <div className="bg-emerald/10 border border-emerald/20 rounded-xl p-4 flex gap-3 text-sm">
                <div className="text-emerald shrink-0 mt-0.5">ℹ️</div>
                <div className="text-txt-secondary">
                  Your wallet will be asked to sign a message to prove ownership. No gas fees are required. This review costs <strong className="text-gold">2 Scarab 🪲</strong>.
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-4">
              <button 
                onClick={() => setReviewModalOpen(false)}
                className="flex-1 py-3.5 rounded-xl border border-border-subtle text-txt-secondary hover:text-txt-primary hover:bg-bg-primary transition-colors font-medium"
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                onClick={submitReview}
                disabled={submitting || comment.length < 10}
                className="flex-[2] py-3.5 rounded-xl bg-gold text-page font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden group"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-page" />
                ) : (
                  <>
                    <MessageSquare className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Sign & Submit Review</span>
                    {/* Hover shine effect */}
                    <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

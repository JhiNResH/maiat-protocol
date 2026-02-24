'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { X, TrendingUp, TrendingDown, Gift, ShoppingCart } from 'lucide-react'

interface ScarabHistoryPanelProps {
  onClose: () => void
}

interface Transaction {
  id: string
  amount: number
  type: string
  description: string | null
  balanceAfter: number
  createdAt: string
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  claim: <Gift className="w-4 h-4 text-emerald-400" />,
  purchase: <ShoppingCart className="w-4 h-4 text-amber-400" />,
  review_spend: <TrendingDown className="w-4 h-4 text-red-400" />,
  vote_spend: <TrendingDown className="w-4 h-4 text-red-400" />,
  reward: <TrendingUp className="w-4 h-4 text-emerald-400" />,
  boost: <TrendingUp className="w-4 h-4 text-purple-400" />,
  refund: <TrendingUp className="w-4 h-4 text-blue-400" />,
}

const TYPE_LABELS: Record<string, string> = {
  claim: 'Daily Claim',
  purchase: 'Purchase',
  review_spend: 'Review Submitted',
  vote_spend: 'Vote Cast',
  reward: 'Reward',
  boost: 'Boost',
  refund: 'Refund',
}

export function ScarabHistoryPanel({ onClose }: ScarabHistoryPanelProps) {
  const { authenticated, user } = usePrivy()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const address = user?.wallet?.address

  useEffect(() => {
    if (address) {
      fetchHistory()
    }
  }, [address])

  const fetchHistory = async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/scarab/history?address=${address}`)
      if (!res.ok) throw new Error('Failed to fetch history')
      const data = await res.json()
      setTransactions(data.transactions || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!authenticated) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-zinc-800/50 border-b border-zinc-800 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Scarab History 🪲</h2>
            <p className="text-sm text-zinc-400 mt-1">
              All your Scarab transactions
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center text-zinc-500 py-12">
              ⏳ Loading transactions...
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              ❌ {error}
            </div>
          )}

          {!loading && !error && transactions.length === 0 && (
            <div className="text-center text-zinc-500 py-12">
              <div className="text-4xl mb-4">📭</div>
              <p>No transactions yet</p>
              <p className="text-sm text-zinc-600 mt-2">
                Your Scarab activity will appear here
              </p>
            </div>
          )}

          {!loading && !error && transactions.length > 0 && (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start gap-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                    {TYPE_ICONS[tx.type] || <TrendingUp className="w-4 h-4 text-zinc-400" />}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <div className="font-semibold text-sm text-white">
                          {TYPE_LABELS[tx.type] || tx.type}
                        </div>
                        {tx.description && (
                          <div className="text-xs text-zinc-500 truncate">
                            {tx.description}
                          </div>
                        )}
                      </div>
                      <div className={`font-bold text-sm ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount} 🪲
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{new Date(tx.createdAt).toLocaleString()}</span>
                      <span>Balance: {tx.balanceAfter} 🪲</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-4">
          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

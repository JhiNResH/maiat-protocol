'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { TrustGauge } from '@/components/TrustGauge'
import { ReviewForm } from '@/components/ReviewForm'
import { ReviewList } from '@/components/ReviewList'
import {
  Copy, Shield, Zap, MessageSquare, Globe, Twitter, Github, ArrowLeft, Brain, Activity, AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface AgentResult {
  address: string
  name: string
  symbol: string
  chain: string
  description?: string
  score: number
  risk: string
  aiAnalysis?: {
    sentiment: string
    techMaturity: string
    socialSignal: string
    summary: string
  }
}

export default function AgentDetailPageWrapper() {
  return (
    <Suspense fallback={<div className='min-h-screen bg-[#030303] flex items-center justify-center text-gold'>Loading Agent...</div>}>
      <AgentDetailPage />
    </Suspense>
  )
}

function AgentDetailPage() {
  const params = useParams()
  const address = params.address as string
  const [result, setResult] = useState<AgentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [refreshReviews, setRefreshReviews] = useState(0)

  useEffect(() => {
    async function fetchAgent() {
      if (!address) return
      try {
        setLoading(true)
        const scoreRes = await fetch('/api/v1/score/' + address + '?summary=true')
        const scoreData = await scoreRes.json()
        if (!scoreRes.ok) { setError(scoreData.error); setLoading(false); return; }

        setResult({
          address: scoreData.address,
          name: scoreData.protocol?.name || 'Autonomous Agent',
          symbol: scoreData.type === 'TOKEN' ? scoreData.protocol?.name?.slice(0, 4).toUpperCase() : 'AGENT',
          chain: scoreData.chain || 'Base',
          description: scoreData.summary,
          score: scoreData.score,
          risk: scoreData.risk,
          aiAnalysis: {
            sentiment: scoreData.score > 7 ? 'Bullish' : 'Neutral',
            techMaturity: scoreData.flags.includes('VERIFIED') ? 'High' : 'Experimental',
            socialSignal: 'Active Community',
            summary: scoreData.summary || 'Agent analysis completed.'
          }
        })
      } catch (err) { setError('Sync error'); }
      finally { setLoading(false); }
    }
    fetchAgent()
  }, [address])

  const score = result?.score ?? 0
  const isHighTrust = score > 7.0

  return (
    <div className='flex flex-col min-h-screen bg-[#030303] text-[#d7dadc]'>
      <Header />
      <div className='flex flex-col gap-6 px-4 md:px-12 py-8 max-w-6xl mx-auto w-full'>
        <Link href='/explore' className='text-[#818384] hover:text-gold text-[10px] font-bold uppercase font-mono tracking-widest'>
          ← Agent Explorer
        </Link>

        {loading ? (
          <div className='py-32 text-center text-gold font-mono'>Scanning Intelligence...</div>
        ) : error ? (
          <div className='p-12 text-center text-crimson font-mono border border-crimson/20 rounded-xl'>{error}</div>
        ) : (
          <div className='flex flex-col lg:flex-row gap-6 animate-in fade-in duration-700'>
            <div className='flex-1 flex flex-col gap-6'>
              <div className='bg-[#1a1a1b] border border-[#343536] rounded-xl p-8 flex items-center gap-10 shadow-2xl'>
                <TrustGauge score={score} />
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center gap-3'>
                    <h1 className='text-4xl font-black'>{result?.name}</h1>
                    <span className='font-mono text-xs font-bold text-gold bg-gold/10 px-2 py-1 rounded'>{result?.symbol}</span>
                  </div>
                  <span className='text-[10px] text-turquoise bg-turquoise/5 border border-turquoise/20 px-3 py-1 rounded-md uppercase tracking-widest'>{result?.chain} NETWORK</span>
                </div>
              </div>

              <div className='bg-[#1a1a1b] border border-[#343536] rounded-xl p-8 shadow-2xl'>
                <div className='flex items-center gap-3 mb-6'>
                  <Brain className='w-5 h-5 text-gold' />
                  <h3 className='text-sm font-bold uppercase tracking-widest font-mono'>AI Analysis</h3>
                </div>
                <div className='grid grid-cols-3 gap-4 mb-8 text-center'>
                  <div className='bg-[#272729] p-4 rounded-xl'>
                    <div className='text-[10px] text-[#818384] uppercase mb-1'>Sentiment</div>
                    <div className='font-bold text-emerald'>{result?.aiAnalysis?.sentiment}</div>
                  </div>
                  <div className='bg-[#272729] p-4 rounded-xl'>
                    <div className='text-[10px] text-[#818384] uppercase mb-1'>Tech</div>
                    <div className='font-bold text-turquoise'>{result?.aiAnalysis?.techMaturity}</div>
                  </div>
                  <div className='bg-[#272729] p-4 rounded-xl'>
                    <div className='text-[10px] text-[#818384] uppercase mb-1'>Signal</div>
                    <div className='font-bold text-gold'>{result?.aiAnalysis?.socialSignal}</div>
                  </div>
                </div>
                <p className='text-[#d7dadc] italic font-serif leading-relaxed'>"{result?.aiAnalysis?.summary}"</p>
              </div>

              <div className='bg-[#1a1a1b] border border-[#343536] rounded-xl p-8 shadow-2xl'>
                <h3 className='text-sm font-bold uppercase tracking-widest font-mono mb-8'>Community Opinions</h3>
                <ReviewList address={address} refreshTrigger={refreshReviews} />
                <div className='mt-10 pt-8 border-t border-[#343536]'>
                  <ReviewForm projectId={address} projectName={result?.name || ''} onSuccess={() => setRefreshReviews(p => p + 1)} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

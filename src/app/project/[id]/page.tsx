import { prisma } from '@/lib/prisma'
import { getSimpleTrustScore } from '@/lib/trust-score'
import { getMarketData, formatNumber, formatPrice } from '@/lib/market-data'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { OR: [{ slug: id }, { id }] }
  })
  if (!project) return { title: 'Not Found | Maiat' }
  const trustScore = getSimpleTrustScore(project.name, project.category, project.avgRating, project.reviewCount)
  return {
    title: `${project.name} Trust Score & Reviews | Maiat`,
    description: `${project.name} has a trust score of ${trustScore}/100 based on ${project.reviewCount} verified reviews on Maiat.`,
  }
}

// Generate AI summary via Gemini
async function getAISummary(projectName: string, reviews: any[], category?: string, description?: string, website?: string, address?: string): Promise<string> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} } as any],
    })
    
    const type = category === 'm/ai-agents' ? 'AI agent' : 'DeFi protocol'
    const context = [
      `Project: ${projectName} (${type})`,
      description ? `Description: ${description}` : '',
      website ? `Website: ${website}` : '',
      address ? `Contract: ${address}` : '',
    ].filter(Boolean).join('\n')

    let prompt: string
    const baseInstructions = `You are a crypto analyst. Be concise. Use this EXACT format (no markdown headers, no bullet lists):

SUMMARY: [1-2 sentences max]
FUNDING: [amount raised, investors — or "No public data"]
STRENGTHS: [2-3 short points separated by " | "]
RISKS: [2-3 short points separated by " | "]

Keep total response under 200 words. No intro, no disclaimers.`

    if (reviews.length === 0) {
      prompt = `${baseInstructions}\n\nResearch "${projectName}".\n\n${context}`
    } else {
      const reviewTexts = reviews.slice(0, 5).map(r => `${r.rating}/5: "${r.content.slice(0, 100)}"`).join('\n')
      prompt = `${baseInstructions}\n\nResearch "${projectName}" considering these reviews:\n${reviewTexts}\n\n${context}`
    }
    
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch (e) {
    return 'AI analysis temporarily unavailable.'
  }
}

// Simple quality score based on review content
function getQualityScore(content: string): number {
  let score = 50
  if (content.length > 100) score += 15
  if (content.length > 200) score += 10
  if (content.length < 20) score -= 20
  // Specific details boost
  if (/\d+/.test(content)) score += 5 // contains numbers
  if (/specific|feature|experience|using|tried|months?|years?|days?/i.test(content)) score += 10
  if (/but|however|although|downside|issue|concern/i.test(content)) score += 5 // balanced review
  // Generic review penalty
  if (/^(good|bad|great|terrible|nice|ok|meh)$/i.test(content.trim())) score -= 30
  return Math.max(0, Math.min(100, score))
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const project = await prisma.project.findFirst({
    where: { OR: [{ slug: id }, { id }] },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { displayName: true, address: true } },
        },
      },
    },
  })

  if (!project) notFound()

  const trustScore = getSimpleTrustScore(project.name, project.category, project.avgRating, project.reviewCount)
  const scoreColor = trustScore >= 80 ? 'text-green-600' : trustScore >= 50 ? 'text-yellow-600' : 'text-red-600'
  const barColor = trustScore >= 80 ? 'bg-green-500' : trustScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const riskLevel = trustScore >= 80 ? 'Low' : trustScore >= 50 ? 'Medium' : 'High'
  const riskColor = trustScore >= 80 ? 'text-green-600 bg-green-50' : trustScore >= 50 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50'
  const categoryLabel = project.category === 'm/ai-agents' ? 'AI Agent' : project.category === 'm/defi' ? 'DeFi' : project.category
  const totalUpvotes = project.reviews.reduce((sum, r) => sum + r.upvotes, 0)
  const totalDownvotes = project.reviews.reduce((sum, r) => sum + r.downvotes, 0)

  // Rating distribution
  const dist = [0, 0, 0, 0, 0]
  project.reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++ })
  const maxDist = Math.max(...dist, 1)

  // AI Summary
  const [aiSummary, marketData] = await Promise.all([
    getAISummary(project.name, project.reviews, project.category, project.description || '', project.website || '', project.address),
    getMarketData(project.name, project.address, project.category),
  ])

  // Rating trend (last 10 reviews, oldest to newest)
  const trendReviews = [...project.reviews].reverse().slice(-10)
  const trendMax = 5
  const trendPoints = trendReviews.map((r, i) => {
    const x = (i / Math.max(trendReviews.length - 1, 1)) * 100
    const y = 100 - (r.rating / trendMax) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117]">
      {/* Header */}
      <header className="bg-white dark:bg-[#1a1b23] border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-70">
          <img src="/logo-light.png" alt="MAIAT" className="w-8 h-8 block dark:hidden" /><img src="/logo-light.png" alt="MAIAT" className="w-8 h-8 hidden dark:block" />
          <span className="text-xl font-bold tracking-tight font-mono text-gray-900 dark:text-gray-100">MAIAT</span>
        </Link>
        <div className="flex-1 flex justify-center px-8">
          <input type="text" placeholder="Search projects, agents, protocols..." className="w-full max-w-xl px-3 py-1.5 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:border-gray-500 bg-gray-50 dark:bg-[#0f1117]" />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a href="https://t.me/MaiatBot" className="text-xs font-mono text-blue-600 hover:underline">@MaiatBot</a>
        </div>
      </header>

      <main className="px-3 sm:px-6 py-4 max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-3 text-xs font-mono text-gray-400 dark:text-gray-500">
          <Link href="/" className="hover:text-gray-600 dark:text-gray-300">Home</Link>
          <span className="mx-1">/</span>
          <span className="text-gray-600 dark:text-gray-300">{project.name}</span>
        </div>

        {/* Title Row */}
        <div className="flex items-center gap-3 mb-4">
          {project.image ? (
            <img src={project.image} alt={project.name} className="w-10 h-10 rounded" />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-bold font-mono text-gray-500 dark:text-gray-400">
              {project.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{project.name}</h1>
          <span className="text-xs font-mono px-2 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-gray-500 dark:text-gray-400">{categoryLabel}</span>
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${riskColor}`}>Risk: {riskLevel}</span>
        </div>

        {/* Overview Grid */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md mb-4">
          <div className="grid grid-cols-2 divide-x divide-gray-200">
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Trust Score:</span>
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-5 rounded-full ${barColor}`} />
                  <span className={`text-2xl font-bold font-mono ${scoreColor}`}>{trustScore}</span>
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500">/ 100</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Avg Rating:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{'⭐'.repeat(Math.round(project.avgRating))} {project.avgRating.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Total Reviews:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{project.reviewCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Sentiment:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">👍 {totalUpvotes} / 👎 {totalDownvotes}</span>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Contract:</span>
                <span className="text-xs font-mono text-blue-600">{project.address.length > 20 ? `${project.address.slice(0, 10)}...${project.address.slice(-6)}` : project.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Chain:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{
                  project.category === 'm/ai-agents' ? 'Base (Virtuals)' :
                  ['PancakeSwap'].includes(project.name) ? 'BNB Chain' :
                  'Ethereum'
                }</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Category:</span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{categoryLabel}</span>
              </div>
              {project.website && (
                <div className="flex justify-between">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Website:</span>
                  <a href={project.website} target="_blank" rel="noopener" className="text-xs font-mono text-blue-600 hover:underline">{project.website.replace('https://', '').replace('http://', '')}</a>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Status:</span>
                <span className="text-xs font-mono px-2 py-0.5 bg-green-50 text-green-700 rounded">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Data */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md mb-4">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase font-mono">📊 Market Data</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 dark:divide-gray-700">
            <div className="p-3 text-center">
              <div className="text-xs font-mono text-gray-400 mb-1">Price</div>
              <div className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">
                {formatPrice(marketData.price)}
                {marketData.priceChange24h ? (
                  <span className={`ml-1 text-xs ${marketData.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marketData.priceChange24h >= 0 ? '+' : ''}{marketData.priceChange24h.toFixed(1)}%
                  </span>
                ) : null}
              </div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xs font-mono text-gray-400 mb-1">Market Cap</div>
              <div className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">{formatNumber(marketData.marketCap || marketData.fdv)}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xs font-mono text-gray-400 mb-1">{marketData.tvl ? 'TVL' : 'Liquidity'}</div>
              <div className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">{formatNumber(marketData.tvl || marketData.liquidity)}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xs font-mono text-gray-400 mb-1">24h Volume</div>
              <div className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">{formatNumber(marketData.volume24h)}</div>
            </div>
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1">
              {marketData.audited ? (
                <><span className="text-green-600">✅</span> Audited</>
              ) : (
                <><span className="text-yellow-600">⚠️</span> Not audited</>
              )}
            </span>
            {marketData.dexUrl && (
              <a href={marketData.dexUrl} target="_blank" rel="noopener" className="text-blue-600 hover:underline">DEXScreener ↗</a>
            )}
            <span className="ml-auto text-gray-400">Data: DEXScreener · DeFiLlama · CoinGecko</span>
          </div>
        </div>

        {/* AI Analysis Summary */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md mb-4 p-4">
          <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase font-mono mb-2 flex items-center gap-2">
            <span>🤖 AI Analysis</span>
            <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(Powered by Gemini)</span>
          </h3>
          <div className="text-sm font-mono text-gray-700 dark:text-gray-200 leading-relaxed space-y-2">
            {aiSummary.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
              const [label, ...rest] = line.split(':')
              const value = rest.join(':').trim()
              if (['SUMMARY', 'FUNDING', 'STRENGTHS', 'RISKS'].includes(label.trim().toUpperCase())) {
                return (
                  <div key={i} className="flex gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      label.trim().toUpperCase() === 'RISKS' ? 'bg-red-500/10 text-red-400' :
                      label.trim().toUpperCase() === 'STRENGTHS' ? 'bg-green-500/10 text-green-400' :
                      label.trim().toUpperCase() === 'FUNDING' ? 'bg-blue-500/10 text-blue-400' :
                      'bg-purple-500/10 text-purple-400'
                    }`}>{label.trim()}</span>
                    <span className="text-gray-600 dark:text-gray-300">{value}</span>
                  </div>
                )
              }
              return <p key={i} className="text-gray-600 dark:text-gray-300">{line}</p>
            })}
          </div>
        </div>

        {/* Rating Distribution + Trend Chart */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Distribution */}
          <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md p-4">
            <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase font-mono mb-3">Rating Distribution</h3>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-6">{star}★</span>
                  <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                    <div className={`h-full rounded ${star >= 4 ? 'bg-green-500' : star === 3 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${(dist[star - 1] / maxDist) * 100}%` }} />
                  </div>
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-4 text-right">{dist[star - 1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trend Chart */}
          <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md p-4">
            <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase font-mono mb-3">Rating Trend</h3>
            {trendReviews.length < 2 ? (
              <div className="h-20 flex items-center justify-center text-xs font-mono text-gray-400 dark:text-gray-500">Need more reviews for trend</div>
            ) : (
              <div className="relative h-20">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 text-[10px] font-mono text-gray-400 dark:text-gray-500">5</div>
                <div className="absolute left-0 bottom-0 text-[10px] font-mono text-gray-400 dark:text-gray-500">1</div>
                {/* Grid lines */}
                <div className="absolute left-4 right-0 top-0 bottom-0">
                  {[0, 25, 50, 75, 100].map(y => (
                    <div key={y} className="absolute w-full border-t border-gray-100 dark:border-gray-800" style={{ top: `${y}%` }} />
                  ))}
                </div>
                {/* SVG Line */}
                <svg className="absolute left-4 right-0 top-0 bottom-0 w-[calc(100%-16px)] h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline points={trendPoints} fill="none" stroke="#22c55e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  {trendReviews.map((r, i) => {
                    const x = (i / Math.max(trendReviews.length - 1, 1)) * 100
                    const y = 100 - (r.rating / trendMax) * 100
                    return <circle key={i} cx={x} cy={y} r="3" fill="#22c55e" vectorEffect="non-scaling-stroke" />
                  })}
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md">
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase font-mono">Reviews ({project.reviews.length})</h3>
            <a href="https://t.me/MaiatBot" className="text-xs font-mono text-blue-600 hover:underline">+ Add Review</a>
          </div>

          {project.reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500 font-mono text-sm">No reviews yet. Be the first — message @MaiatBot.</div>
          ) : (
            <div>
              {project.reviews.map((review, i) => {
                const displayAddr = review.reviewer.address.startsWith('tg:')
                  ? review.reviewer.displayName || `tg:${review.reviewer.address.slice(3, 7)}...`
                  : `${review.reviewer.address.slice(0, 6)}...${review.reviewer.address.slice(-4)}`
                const date = new Date(review.createdAt).toISOString().split('T')[0]
                const ratingColor = review.rating >= 4 ? 'text-green-600' : review.rating >= 3 ? 'text-yellow-600' : 'text-red-600'
                const quality = getQualityScore(review.content)
                const qualityColor = quality >= 70 ? 'text-green-600' : quality >= 40 ? 'text-yellow-600' : 'text-red-600'

                return (
                  <div key={review.id} className={`px-4 py-3 ${i < project.reviews.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''} hover:bg-gray-50 dark:hover:bg-gray-800`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">{displayAddr}</span>
                        {review.reviewer.address.startsWith('tg:') ? (
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded">📱 via Telegram</span>
                        ) : (
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">🛡️ Verified Human</span>
                        )}
                        <span className={`text-xs font-mono ${ratingColor}`}>Rating: {review.rating}.0</span>
                        {review.txHash && (
                          <span className="text-xs font-mono px-1.5 py-0.5 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded">On-chain ✓</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono ${qualityColor}`}>Quality: {quality}</span>
                        <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{date}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-200 font-mono leading-relaxed">{review.content}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* API Info */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md mt-4 p-4">
          <h3 className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase font-mono mb-2">API Access</h3>
          <code className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 px-3 py-2 rounded block">
            GET /api/trust-score?project={project.name}
          </code>
          <p className="text-xs font-mono text-gray-400 dark:text-gray-500 mt-2">Public endpoint for AI agents. No authentication required.</p>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center text-xs font-mono text-gray-400 dark:text-gray-500 py-4">
          Maiat — Verified review layer for agentic commerce · 
          <a href="https://t.me/MaiatBot" className="text-blue-600 hover:underline ml-1">@MaiatBot</a> · 
          <a href="https://x.com/0xmaiat" target="_blank" rel="noopener" className="text-blue-600 hover:underline ml-1">@0xmaiat</a>
        </div>
      </main>
    </div>
  )
}

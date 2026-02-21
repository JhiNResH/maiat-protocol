import { prisma } from '@/lib/prisma'
import { getSimpleTrustScore } from '@/lib/trust-score'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LiveRefresh } from '@/components/LiveRefresh'
import { SearchBar } from '@/components/SearchBar'
import { CategoryTabs } from '@/components/CategoryTabs'
import { TrustScoreTooltip } from '@/components/TrustScoreTooltip'
import { SwapWidget } from '@/components/SwapWidget'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'ai-agents', label: '🤖 AI Agents', dbValue: 'm/ai-agents' },
  { key: 'defi', label: '🏦 DeFi', dbValue: 'm/defi' },
  { key: 'coffee', label: '☕ Coffee', dbValue: 'm/coffee' },
]

export default async function HomePage({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; view?: string }> }) {
  const { q, cat, view } = await searchParams
  const isSwap = view === 'swap'
  const activeCat = CATEGORIES.find(c => c.key === cat) ?? CATEGORIES[0]

  const where: any = {}
  if (activeCat.key !== 'all') {
    where.category = activeCat.dbValue
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ]
  }

  const allProjects = await prisma.project.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { reviewCount: 'desc' },
  })

  const totalReviews = allProjects.reduce((sum, p) => sum + p.reviewCount, 0)
  const totalProjects = allProjects.length
  const avgTrustScore = allProjects.length > 0
    ? Math.round(allProjects.reduce((sum, p) => sum + getSimpleTrustScore(p.name, p.category, p.avgRating, p.reviewCount), 0) / allProjects.length)
    : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f1117]">
      {/* Header */}
      <header className="bg-white dark:bg-[#1a1b23] border-b border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0 hover:opacity-70 transition-opacity">
          <img src="/logo-light.png" alt="MAIAT" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
          <h1 className="text-lg sm:text-xl font-bold tracking-tight font-mono text-gray-900 dark:text-gray-100">MAIAT</h1>
        </Link>
        <div className="flex-1 flex justify-center px-2 sm:px-8">
          <SearchBar />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href={isSwap ? '/' : '/?view=swap'} className={`text-xs font-mono px-2.5 py-1 rounded-md transition-colors ${isSwap ? 'bg-blue-600 text-white' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}>
            Swap
          </Link>
          <LiveRefresh />
          <ThemeToggle />
          <a href="https://t.me/MaiatBot" className="text-xs font-mono text-blue-600 hover:underline hidden sm:inline">@MaiatBot</a>
        </div>
      </header>

      <main className="px-3 sm:px-6 py-4 max-w-5xl mx-auto">
        {isSwap ? (
          <SwapWidget />
        ) : (
        <>
        {/* Stats Bar */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md mb-4 p-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-8 text-xs font-mono">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Projects: </span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{totalProjects}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Reviews: </span>
              <span className="font-bold text-gray-900 dark:text-gray-100">{totalReviews}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Avg Score: </span>
              <span className="font-bold text-green-600">{avgTrustScore}/100</span>
            </div>
            <div className="hidden sm:block ml-auto">
              <span className="text-gray-400 dark:text-gray-500">The trust score layer for agentic commerce</span>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md mb-4 p-6">
          <h2 className="text-center text-sm font-bold font-mono text-gray-900 dark:text-gray-100 mb-6 tracking-wide">
            HOW IT WORKS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="text-center">
              <div className="text-3xl mb-3">🔍</div>
              <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-wide">
                STEP 1: DISCOVER
              </div>
              <div className="font-mono text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Ask our bot or browse for trusted recommendations
              </div>
            </div>
            {/* Step 2 */}
            <div className="text-center">
              <div className="text-3xl mb-3">✅</div>
              <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-wide">
                STEP 2: VERIFY
              </div>
              <div className="font-mono text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                AI + on-chain verification ensures authentic reviews
              </div>
            </div>
            {/* Step 3 */}
            <div className="text-center">
              <div className="text-3xl mb-3">✍️</div>
              <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100 mb-2 tracking-wide">
                STEP 3: REVIEW
              </div>
              <div className="font-mono text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Share your experience, earn reputation
              </div>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <CategoryTabs categories={CATEGORIES.map(c => ({ key: c.key, label: c.label }))} activeKey={activeCat.key} />

        {/* Table */}
        <div className="bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#0f1117]">
            <span className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase font-mono">
              {activeCat.label === 'All' ? 'All Projects' : activeCat.label} ({totalProjects})
            </span>
          </div>

          {/* Desktop Table */}
          <table className="w-full hidden md:table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">#</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">Project</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">Category</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">Trust Score</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">Reviews</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">Rating</th>
                <th className="text-left px-4 py-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase font-mono">Risk</th>
              </tr>
            </thead>
            <tbody>
              {allProjects.map((project, i) => {
                const trustScore = getSimpleTrustScore(project.name, project.category, project.avgRating, project.reviewCount)
                const scoreColor = trustScore >= 80 ? 'text-green-600' : trustScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                const barColor = trustScore >= 80 ? 'bg-green-500' : trustScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                const riskLevel = trustScore >= 80 ? 'Low' : trustScore >= 50 ? 'Medium' : 'High'
                const riskColor = trustScore >= 80 ? 'text-green-600' : trustScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                const categoryLabel = project.category === 'm/ai-agents' ? 'AI Agent' : project.category === 'm/coffee' ? 'Coffee' : 'DeFi'

                return (
                  <tr key={project.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-400 dark:text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/m/${project.category.replace('m/', '')}/${(project as any).slug || project.id}`} className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline font-mono">
                        {project.image ? (
                          <img src={project.image} alt="" className="w-5 h-5 rounded" />
                        ) : (
                          <div className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] font-bold text-gray-500">{project.name.slice(0, 2)}</div>
                        )}
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300">{categoryLabel}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <TrustScoreTooltip
                        trustScore={trustScore}
                        reviewCount={project.reviewCount}
                        avgRating={project.avgRating}
                        scoreColor={scoreColor}
                        barColor={barColor}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 font-mono">{project.reviewCount}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 font-mono">{project.avgRating.toFixed(1)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-mono ${riskColor}`}>{riskLevel}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {allProjects.map((project, i) => {
              const trustScore = getSimpleTrustScore(project.name, project.category, project.avgRating, project.reviewCount)
              const scoreColor = trustScore >= 80 ? 'text-green-600' : trustScore >= 50 ? 'text-yellow-600' : 'text-red-600'
              const riskLevel = trustScore >= 80 ? 'Low' : trustScore >= 50 ? 'Medium' : 'High'
              const riskColor = trustScore >= 80 ? 'text-green-600' : trustScore >= 50 ? 'text-yellow-600' : 'text-red-600'
              const categoryLabel = project.category === 'm/ai-agents' ? 'AI Agent' : project.category === 'm/coffee' ? 'Coffee' : 'DeFi'

              return (
                <Link
                  key={project.id}
                  href={`/m/${project.category.replace('m/', '')}/${(project as any).slug || project.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                >
                  <span className="text-xs font-mono text-gray-400 w-5 shrink-0">{i + 1}</span>
                  {project.image ? (
                    <img src={project.image} alt="" className="w-8 h-8 rounded shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">{project.name.slice(0, 2)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-600 font-mono truncate">{project.name}</span>
                      <span className="text-[10px] font-mono px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 shrink-0">{categoryLabel}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs font-mono text-gray-400">
                      <span>{project.reviewCount} reviews</span>
                      <span>⭐ {project.avgRating.toFixed(1)}</span>
                      <span className={riskColor}>{riskLevel}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-lg font-bold font-mono ${scoreColor}`}>{trustScore}</span>
                    <div className="text-[10px] font-mono text-gray-400">/100</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
        </>
        )}
        {/* Footer */}
        <div className="mt-4 text-center text-xs font-mono text-gray-400 dark:text-gray-500 py-4">
          Maiat — Verified review layer for agentic commerce · 
          <a href="https://t.me/MaiatBot" className="text-blue-600 hover:underline ml-1">@MaiatBot</a> · 
          <a href="https://x.com/0xmaiat" target="_blank" rel="noopener" className="text-blue-600 hover:underline ml-1">@0xmaiat</a> · 
          <span className="ml-1">API: /api/trust-score</span>
        </div>
      </main>
    </div>
  )
}

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Note: rate limiting is skipped in tests (UPSTASH env vars not set)

// vi.hoisted ensures these are available when vi.mock factory runs (hoisted)
const { mockFindMany, mockCount } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findMany: mockFindMany,
      count: mockCount,
    },
  },
}))

import { GET } from '@/app/api/v1/agents/route'

/** Factory for a minimal valid agent matching the Prisma select shape */
function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    address: '0xtest',
    name: 'Test Agent',
    slug: 'test-agent',
    symbol: 'TEST',
    chain: 'base',
    tier: '1',
    description: 'A test agent',
    trustScore: 75,
    trustGrade: 'B',
    onChainScore: 80,
    offChainScore: 70,
    humanScore: 60,
    marketCap: 1000000,
    price: 1.5,
    reviewCount: 10,
    avgRating: 4.2,
    website: 'https://test.com',
    twitter: '@test',
    ...overrides,
  }
}

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/v1/agents')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new NextRequest(url)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindMany.mockResolvedValue([makeAgent()])
  mockCount.mockResolvedValue(1)
})

describe('GET /api/v1/agents', () => {
  it('default params: limit=50, offset=0, sort=trustScore desc', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
        orderBy: { trustScore: 'desc' },
      })
    )
  })

  it('limit capped at 100: limit=999 → take: 100', async () => {
    await GET(makeRequest({ limit: '999' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  it('sort=market_cap → orderBy.marketCap = desc', async () => {
    await GET(makeRequest({ sort: 'market_cap' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { marketCap: 'desc' } })
    )
  })

  it('sort=name → orderBy.name = asc', async () => {
    await GET(makeRequest({ sort: 'name' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } })
    )
  })

  it('sort=reviews → orderBy.reviewCount = desc', async () => {
    await GET(makeRequest({ sort: 'reviews' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { reviewCount: 'desc' } })
    )
  })

  it('sort=anything_else → defaults to trustScore desc', async () => {
    await GET(makeRequest({ sort: 'garbage' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { trustScore: 'desc' } })
    )
  })

  it('chain filter applied when chain param provided', async () => {
    await GET(makeRequest({ chain: 'Base' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ chain: 'base' }),
      })
    )
  })

  it('tier filter applied when tier param provided', async () => {
    await GET(makeRequest({ tier: '2' }))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tier: '2' }),
      })
    )
  })

  it('response includes correct agent shape', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.agents[0]).toMatchObject({
      id: '0xtest',
      name: 'Test Agent',
      trust: { score: 75, grade: 'B' },
      market_cap: 1000000,
      reviews: 10,
    })
    expect(body.pagination).toMatchObject({
      total: 1,
      limit: 50,
      offset: 0,
      has_more: false,
    })
  })

  // FIXED M3: offset clamped to >= 0
  it('[M3] negative offset is clamped to 0', async () => {
    const res = await GET(makeRequest({ offset: '-1' }))
    expect(res.status).toBe(200)

    // offset=-1 should be clamped to skip: 0
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 })
    )
  })
})

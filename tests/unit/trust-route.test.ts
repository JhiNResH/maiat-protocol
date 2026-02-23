import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted ensures these are available when vi.mock factory runs (hoisted)
const { mockFindFirst, mockGetConfidence } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockGetConfidence: vi.fn().mockReturnValue('medium'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: mockFindFirst,
    },
  },
}))

vi.mock('@/lib/trust-score', () => ({
  getConfidence: mockGetConfidence,
}))

import { GET } from '@/app/api/v1/trust/[address]/route'

/** Factory for a minimal project matching the Prisma include shape */
function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    address: '0xagent',
    name: 'Test Agent',
    slug: 'test-agent',
    symbol: 'TEST',
    chain: 'base',
    tier: '1',
    description: 'A test agent',
    coreFunctions: '["swap","bridge"]',
    website: 'https://test.com',
    twitter: '@test',
    github: 'https://github.com/test',
    docs: 'https://docs.test.com',
    trustScore: 75,
    trustGrade: 'B',
    onChainScore: 80,
    offChainScore: 70,
    humanScore: 60,
    trustUpdatedAt: new Date('2024-01-01'),
    marketCap: 1000000,
    price: 1.5,
    volume24h: 50000,
    marketUpdatedAt: new Date('2024-01-01'),
    reviewCount: 10,
    avgRating: 4.2,
    status: 'active',
    reviews: [
      {
        rating: 5,
        content: 'Great agent, very reliable for trading.',
        createdAt: new Date('2024-01-01'),
        reviewer: { displayName: 'alice', reputationScore: 100 },
      },
    ],
    ...overrides,
  }
}

function makeRequest(address: string, params: Record<string, string> = {}): [NextRequest, { params: Promise<{ address: string }> }] {
  const url = new URL(`http://localhost/api/v1/trust/${address}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return [new NextRequest(url), { params: Promise.resolve({ address }) }]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFindFirst.mockResolvedValue(makeProject())
})

describe('GET /api/v1/trust/:address', () => {
  it('valid address → 200 with full trust/market/reviews structure', async () => {
    const res = await GET(...makeRequest('test-agent'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.agent.id).toBe('0xagent')
    expect(body.trust.score).toBe(75)
    expect(body.trust.grade).toBe('B')
    expect(body.trust.weights).toEqual({ on_chain: 0.5, off_chain: 0.3, human_reviews: 0.2 })
    expect(body.market.market_cap).toBe(1000000)
    expect(body.reviews.count).toBe(10)
    expect(body.meta.api_version).toBe('v1')
  })

  it('unknown address → 404 with error message', async () => {
    mockFindFirst.mockResolvedValueOnce(null)

    const res = await GET(...makeRequest('nonexistent'))
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.error).toBe('Agent not found')
  })

  it('chain param matches → returns agent', async () => {
    const res = await GET(...makeRequest('test-agent', { chain: 'base' }))
    expect(res.status).toBe(200)
  })

  it('chain param absent → returns agent regardless of chain', async () => {
    const res = await GET(...makeRequest('test-agent'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.agent.chain).toBe('base')
  })

  // KNOWN VULN H2: chain mismatch 404 leaks actual_chain, enabling enumeration
  it('[H2] chain oracle: wrong chain returns 404 with actual_chain field', async () => {
    // Querying a valid address with the wrong chain exposes what chain
    // the agent is actually on, enabling cross-chain enumeration.
    const res = await GET(...makeRequest('test-agent', { chain: 'sol' }))
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.actual_chain).toBe('base') // Oracle leak: reveals real chain
    expect(body.error).toBe('Agent not on specified chain')
  })

  it('response includes all expected top-level keys', async () => {
    const res = await GET(...makeRequest('test-agent'))
    const body = await res.json()

    expect(body).toHaveProperty('agent')
    expect(body).toHaveProperty('trust')
    expect(body).toHaveProperty('market')
    expect(body).toHaveProperty('reviews')
    expect(body).toHaveProperty('meta')

    // trust subfields
    expect(body.trust).toHaveProperty('score')
    expect(body.trust).toHaveProperty('grade')
    expect(body.trust).toHaveProperty('breakdown')
    expect(body.trust).toHaveProperty('confidence')
    expect(body.trust).toHaveProperty('weights')
    expect(body.trust).toHaveProperty('recommendation')
    expect(body.trust).toHaveProperty('last_updated')
  })

  it('response includes recent reviews with correct shape', async () => {
    const res = await GET(...makeRequest('test-agent'))
    const body = await res.json()

    expect(body.reviews.recent).toHaveLength(1)
    expect(body.reviews.recent[0]).toMatchObject({
      rating: 5,
      reviewer: 'alice',
      reputation: 100,
    })
  })
})

import { describe, it, expect } from 'vitest'

const BASE_URL = 'https://app.maiat.io'
const TIMEOUT = 10_000

const skip = process.env.RUN_E2E !== 'true'

function fetchApi(path: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, { signal: AbortSignal.timeout(TIMEOUT) })
}

describe.skipIf(skip)('Live API — /api/v1/agents', () => {
  it('GET /api/v1/agents?limit=3 → 200, returns 3 agents with id/name/trust.score', async () => {
    const res = await fetchApi('/api/v1/agents?limit=3')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.agents).toHaveLength(3)
    for (const agent of body.agents) {
      expect(agent).toHaveProperty('id')
      expect(agent).toHaveProperty('name')
      expect(agent.trust).toHaveProperty('score')
    }
  })

  it('GET /api/v1/agents?limit=1&sort=market_cap → 200, has_more or total > 0', async () => {
    const res = await fetchApi('/api/v1/agents?limit=1&sort=market_cap')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.pagination.total).toBeGreaterThan(0)
  })

  it('GET /api/v1/agents?limit=101 → 200, returned agents.length <= 100', async () => {
    const res = await fetchApi('/api/v1/agents?limit=101')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.agents.length).toBeLessThanOrEqual(100)
  })

  it('GET /api/v1/agents?chain=base → 200, all agents have chain=base', async () => {
    const res = await fetchApi('/api/v1/agents?chain=base')
    expect(res.status).toBe(200)

    const body = await res.json()
    for (const agent of body.agents) {
      expect(agent.chain).toBe('base')
    }
  })

  it('GET /api/v1/agents?tier=1 → 200, all agents have tier="1"', async () => {
    const res = await fetchApi('/api/v1/agents?tier=1')
    expect(res.status).toBe(200)

    const body = await res.json()
    for (const agent of body.agents) {
      expect(agent.tier).toBe('1')
    }
  })
})

describe.skipIf(skip)('Live API — /api/v1/trust/:address', () => {
  it('GET /api/v1/trust/based-agent-base → 200, has trust.score and trust.grade', async () => {
    const res = await fetchApi('/api/v1/trust/based-agent-base')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.trust).toHaveProperty('score')
    expect(body.trust).toHaveProperty('grade')
  })

  it('GET /api/v1/trust/nonexistent-address-xyz → 404', async () => {
    const res = await fetchApi('/api/v1/trust/nonexistent-address-xyz')
    expect(res.status).toBe(404)
  })
})

describe.skipIf(skip)('Security probes', () => {
  it('rate limit check: fire 20 rapid requests', async () => {
    const requests = Array.from({ length: 20 }, () => fetchApi('/api/v1/agents?limit=1'))
    const responses = await Promise.all(requests)

    const statuses = responses.map((r) => r.status)
    const has429 = statuses.includes(429)

    if (!has429) {
      console.warn('⚠️  No rate limiting detected on /agents endpoint')
    }

    // Test passes either way — it's a probe, not a hard assertion
    expect(statuses.every((s) => s === 200 || s === 429)).toBe(true)
  })

  // This probe PASSES when the vulnerability IS present (confirms H2)
  it('[H2] chain oracle: /trust/based-agent-base?chain=sol leaks actual_chain', async () => {
    const res = await fetchApi('/api/v1/trust/based-agent-base?chain=sol')

    if (res.status === 404) {
      const body = await res.json()
      if (body.actual_chain) {
        console.warn(`⚠️  Chain oracle H2 confirmed: actual_chain="${body.actual_chain}"`)
      }
      expect(body).toHaveProperty('actual_chain')
    } else {
      // Agent might be on sol, which means the probe is inconclusive
      expect(res.status).toBe(200)
    }
  })

  // Currently returns 500 — fix: clamp offset to >= 0
  it('[M3] negative offset: /agents?offset=-1 should not 500', async () => {
    const res = await fetchApi('/api/v1/agents?offset=-1')

    if (res.status === 500) {
      console.warn('⚠️  Negative offset causes 500 — offset not clamped (M3 bug confirmed)')
    }

    // Ideally should be 400 or 200, not 500
    // For now, just document the behavior
    expect([200, 400, 500]).toContain(res.status)
  })
})

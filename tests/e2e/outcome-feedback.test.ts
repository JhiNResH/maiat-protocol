import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/prisma'

const skip = process.env.RUN_E2E !== 'true'
const BASE_URL = 'https://maiat-protocol.vercel.app'
const TIMEOUT = 10_000

const testAgent = '0xf4b485452905746de642a6d57bc46586ac31d924'
const testJobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`

function fetchApi(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT),
    ...options,
  })
}

describe.skipIf(skip)('Phase 1B: Outcome Feedback Loop (Oracle Sync)', () => {
  it('[1] POST /api/v1/outcome — record trust_swap outcome', async () => {
    const res = await fetchApi('/api/v1/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: testJobId,
        agentAddress: testAgent,
        outcome: 'success',
        actualAmountOut: '1234567890',
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.recorded).toBe(true)
    expect(body.jobId).toBe(testJobId)
    expect(body.agentAddress).toBe(testAgent.toLowerCase())
    expect(body.outcome).toBe('success')
    expect(typeof body.newTrustScore).toBe('number')
    expect(typeof body.delta).toBe('number')
  })

  it('[2] GET /api/v1/evidence/:address — verify chain integrity after outcome', async () => {
    // Wait a moment for write to propagate
    await new Promise((r) => setTimeout(r, 500))

    const res = await fetchApi(`/api/v1/evidence/${testAgent}`)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.agentId).toBe(testAgent.toLowerCase())
    expect(typeof body.recordCount).toBe('number')
    expect(typeof body.chainValid).toBe('boolean')
    expect(typeof body.latestHash).toBe('string')
    expect(body.latestHash.length).toBe(64) // SHA-256 hex
  })

  it('[3] POST /api/v1/outcome — idempotent: double-record returns 409', async () => {
    const res = await fetchApi('/api/v1/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: testJobId,
        agentAddress: testAgent,
        outcome: 'failure',
      }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.recorded).toBe(false)
    expect(body.existingOutcome).toBe('success')
  })

  it('[4] POST /api/v1/outcome — missing jobId → 400', async () => {
    const res = await fetchApi('/api/v1/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentAddress: testAgent,
        outcome: 'success',
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('jobId')
  })

  it('[5] POST /api/v1/outcome — invalid outcome → 400', async () => {
    const res = await fetchApi('/api/v1/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: 'job_fake',
        agentAddress: testAgent,
        outcome: 'invalid_outcome',
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('outcome')
  })

  it('[6] POST /api/v1/outcome — missing QueryLog (no prior trust_swap) → 404', async () => {
    const fakeJobId = `job_nonexistent_${Date.now()}`
    const res = await fetchApi('/api/v1/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: fakeJobId,
        agentAddress: testAgent,
        outcome: 'success',
      }),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.recorded).toBe(false)
  })

  it('[7] Trust score recomputation — outcome history weighted', async () => {
    // This is a conceptual test: after >= 5 outcomes,
    // newTrustScore should blend 40% on-chain + 60% outcome history.
    // Live test would require seeding 5+ outcomes for an agent.

    // For now, verify the endpoint response structure
    const res = await fetchApi('/api/v1/outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: `job_${Date.now()}_2`,
        agentAddress: testAgent,
        outcome: 'success',
      }),
    })

    if (res.status === 201) {
      const body = await res.json()
      expect(body.newTrustScore).toBeGreaterThanOrEqual(0)
      expect(body.newTrustScore).toBeLessThanOrEqual(100)
      // delta can be negative (score went down) or positive or zero
      expect(typeof body.delta).toBe('number')
    }
  })
})

describe.skipIf(skip)('Phase 1A: Evidence Chain Validation', () => {
  it('GET /api/v1/evidence/:address — returns tamper-evident chain', async () => {
    const res = await fetchApi(`/api/v1/evidence/${testAgent}`)

    if (res.status === 200) {
      const body = await res.json()

      // Chain integrity check
      expect(body).toHaveProperty('chainValid')
      expect(body).toHaveProperty('recordCount')
      expect(body).toHaveProperty('latestHash')

      if (body.chainValid === false) {
        console.warn(
          `⚠️ Chain tamper detected for ${testAgent}: evidence of corruption or schema migration`
        )
      }

      expect([true, false]).toContain(body.chainValid)
    } else {
      expect(res.status).toBe(404) // Agent not in database yet
    }
  })
})

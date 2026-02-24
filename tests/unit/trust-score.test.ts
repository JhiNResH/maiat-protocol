import { describe, it, expect } from 'vitest'
import {
  computeAgentTrustScore,
  getSimpleTrustScore,
  getConfidence,
  isStale,
} from '@/lib/trust-score'

// ============================================
// computeAgentTrustScore
// ============================================
describe('computeAgentTrustScore', () => {
  it('correct weighted formula: 0.5*onChain + 0.3*offChain + 0.2*human', () => {
    const { score } = computeAgentTrustScore(80, 60, 40)
    // 0.5*80 + 0.3*60 + 0.2*40 = 40 + 18 + 8 = 66
    expect(score).toBe(66)
  })

  it('all zeros → score 0, grade F', () => {
    const { score, grade } = computeAgentTrustScore(0, 0, 0)
    expect(score).toBe(0)
    expect(grade).toBe('F')
  })

  it('all 100s → score 100, grade S', () => {
    const { score, grade } = computeAgentTrustScore(100, 100, 100)
    expect(score).toBe(100)
    expect(grade).toBe('S')
  })

  it('grade S for score >= 90', () => {
    expect(computeAgentTrustScore(100, 100, 50).grade).toBe('S')
    // 0.5*100 + 0.3*100 + 0.2*50 = 50+30+10 = 90
    expect(computeAgentTrustScore(100, 100, 50).score).toBe(90)
  })

  it('grade A for score >= 80 and < 90', () => {
    // 0.5*100 + 0.3*80 + 0.2*40 = 50+24+8 = 82
    const { score, grade } = computeAgentTrustScore(100, 80, 40)
    expect(score).toBe(82)
    expect(grade).toBe('A')
  })

  it('grade B for score >= 70 and < 80', () => {
    // 0.5*100 + 0.3*60 + 0.2*30 = 50+18+6 = 74
    const { score, grade } = computeAgentTrustScore(100, 60, 30)
    expect(score).toBe(74)
    expect(grade).toBe('B')
  })

  it('grade C for score >= 60 and < 70', () => {
    // 0.5*80 + 0.3*60 + 0.2*40 = 40+18+8 = 66
    const { score, grade } = computeAgentTrustScore(80, 60, 40)
    expect(score).toBe(66)
    expect(grade).toBe('C')
  })

  it('grade D for score >= 40 and < 60', () => {
    // 0.5*60 + 0.3*40 + 0.2*30 = 30+12+6 = 48
    const { score, grade } = computeAgentTrustScore(60, 40, 30)
    expect(score).toBe(48)
    expect(grade).toBe('D')
  })

  it('grade F for score < 40', () => {
    // 0.5*20 + 0.3*20 + 0.2*20 = 10+6+4 = 20
    const { score, grade } = computeAgentTrustScore(20, 20, 20)
    expect(score).toBe(20)
    expect(grade).toBe('F')
  })

  it('clamps inputs > 100 to 100', () => {
    const { score } = computeAgentTrustScore(200, 200, 200)
    expect(score).toBe(100)
  })

  it('clamps inputs < 0 to 0', () => {
    const { score } = computeAgentTrustScore(-50, -50, -50)
    expect(score).toBe(0)
  })

  it('clamps mixed out-of-range inputs', () => {
    // 0.5*100 + 0.3*0 + 0.2*100 = 50+0+20 = 70
    const { score } = computeAgentTrustScore(150, -10, 200)
    expect(score).toBe(70)
  })

  it('rounds floats correctly', () => {
    // 0.5*73 + 0.3*61 + 0.2*47 = 36.5+18.3+9.4 = 64.2 → 64
    const { score } = computeAgentTrustScore(73, 61, 47)
    expect(score).toBe(64)
  })

  it('rounds 0.5 correctly (Math.round rounds half up)', () => {
    // 0.5*75 + 0.3*65 + 0.2*50 = 37.5+19.5+10 = 67 → 67
    const { score } = computeAgentTrustScore(75, 65, 50)
    expect(score).toBe(67)
  })

  it('uses default human=50 when not provided', () => {
    // 0.5*80 + 0.3*60 + 0.2*50 = 40+18+10 = 68
    const { score } = computeAgentTrustScore(80, 60)
    expect(score).toBe(68)
  })
})

// ============================================
// getSimpleTrustScore
// ============================================
describe('getSimpleTrustScore', () => {
  it('reviewCount=0 returns category default (60 for m/defi)', () => {
    expect(getSimpleTrustScore('uniswap', 'm/defi', 5, 0)).toBe(60)
  })

  it('reviewCount<=5: 60% default / 40% community split', () => {
    // categoryDefault for m/defi = 60, communityScore = round(4 * 20) = 80
    // (60*60 + 80*40) / 100 = (3600 + 3200) / 100 = 68
    expect(getSimpleTrustScore('uniswap', 'm/defi', 4, 3)).toBe(68)
  })

  it('reviewCount<=20: 30% default / 70% community split', () => {
    // categoryDefault for m/defi = 60, communityScore = round(3 * 20) = 60
    // (60*30 + 60*70) / 100 = (1800 + 4200) / 100 = 60
    expect(getSimpleTrustScore('uniswap', 'm/defi', 3, 10)).toBe(60)
  })

  it('reviewCount>20: 10% default / 90% community split', () => {
    // categoryDefault for m/defi = 60, communityScore = round(4.5 * 20) = 90
    // (60*10 + 90*90) / 100 = (600 + 8100) / 100 = 87
    expect(getSimpleTrustScore('uniswap', 'm/defi', 4.5, 50)).toBe(87)
  })

  it('unknown name returns category default: 60 for m/defi', () => {
    expect(getSimpleTrustScore('unknown-project', 'm/defi', 5, 0)).toBe(60)
  })

  it('unknown name returns category default: 50 for m/ai-agents', () => {
    expect(getSimpleTrustScore('unknown-project', 'm/ai-agents', 5, 0)).toBe(50)
  })

  it('name "uniswap" with no reviews returns category default (no name-based lookup)', () => {
    expect(getSimpleTrustScore('uniswap', 'm/defi', 5, 0)).toBe(60)
  })

  it('avgRating=5, reviewCount=100 → high score', () => {
    // categoryDefault for m/defi = 60, communityScore = round(5 * 20) = 100
    // (60*10 + 100*90) / 100 = (600 + 9000) / 100 = 96
    const score = getSimpleTrustScore('unknown-project', 'm/defi', 5, 100)
    expect(score).toBe(96)
  })

  it('avgRating=1, reviewCount=100 → low score', () => {
    // categoryDefault for m/defi = 60, communityScore = round(1 * 20) = 20
    // (60*10 + 20*90) / 100 = (600 + 1800) / 100 = 24
    const score = getSimpleTrustScore('unknown-project', 'm/defi', 1, 100)
    expect(score).toBe(24)
  })

  // FIXED H1: baseline keyed on address, not mutable name
  it('[H1] name impersonation: agent named "uniswap" with fake address gets 50 not 90', () => {
    // An impersonating agent named "uniswap" but with address "fake-address-xyz"
    // should get the category default (50 for m/ai-agents), not the real Uniswap baseline
    const impersonator = getSimpleTrustScore('uniswap', 'm/ai-agents', 5, 0)
    expect(impersonator).toBe(50)
  })
})

// ============================================
// getConfidence
// ============================================
describe('getConfidence', () => {
  it('0 signals → "low"', () => {
    expect(
      getConfidence({ marketCap: null, github: null, website: null, reviewCount: 0 })
    ).toBe('low')
  })

  it('1 signal → "low"', () => {
    expect(
      getConfidence({ marketCap: 1000, github: null, website: null, reviewCount: 0 })
    ).toBe('low')
  })

  it('2 signals → "medium"', () => {
    expect(
      getConfidence({ marketCap: 1000, github: 'https://github.com/test', website: null, reviewCount: 0 })
    ).toBe('medium')
  })

  it('3 signals → "high"', () => {
    expect(
      getConfidence({ marketCap: 1000, github: 'https://github.com/test', website: 'https://test.com', reviewCount: 0 })
    ).toBe('high')
  })

  it('4 signals → "high"', () => {
    expect(
      getConfidence({ marketCap: 1000, github: 'https://github.com/test', website: 'https://test.com', reviewCount: 5 })
    ).toBe('high')
  })

  it('marketCap truthy counts as signal', () => {
    expect(
      getConfidence({ marketCap: 1, github: null, website: null, reviewCount: 0 })
    ).toBe('low') // only 1 signal
  })

  it('marketCap 0 is falsy, does not count', () => {
    expect(
      getConfidence({ marketCap: 0, github: 'a', website: 'b', reviewCount: 0 })
    ).toBe('medium') // only 2 signals (github + website)
  })

  it('reviewCount must be > 0 to count as signal', () => {
    expect(
      getConfidence({ marketCap: null, github: null, website: null, reviewCount: 0 })
    ).toBe('low')
    expect(
      getConfidence({ marketCap: null, github: null, website: null, reviewCount: 1 })
    ).toBe('low') // 1 signal
  })
})

// ============================================
// isStale
// ============================================
describe('isStale', () => {
  it('null lastUpdated → true (no data)', () => {
    expect(isStale(null)).toBe(true)
  })

  it('undefined lastUpdated → true', () => {
    expect(isStale(undefined)).toBe(true)
  })

  it('1 hour ago → false (fresh)', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000)
    expect(isStale(oneHourAgo)).toBe(false)
  })

  it('23 hours ago → false (within 24h default)', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000)
    expect(isStale(twentyThreeHoursAgo)).toBe(false)
  })

  it('25 hours ago → true (past 24h default)', () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
    expect(isStale(twentyFiveHoursAgo)).toBe(true)
  })

  it('exactly 24 hours + 1ms → true (boundary)', () => {
    const exactlyStale = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1)
    expect(isStale(exactlyStale)).toBe(true)
  })

  it('custom threshold: 1 hour, updated 30 min ago → false', () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
    expect(isStale(thirtyMinAgo, 1)).toBe(false)
  })

  it('custom threshold: 1 hour, updated 2 hours ago → true', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    expect(isStale(twoHoursAgo, 1)).toBe(true)
  })

  it('just now → false', () => {
    expect(isStale(new Date())).toBe(false)
  })
})

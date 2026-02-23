import { describe, it, expect } from 'vitest'
import {
  computeAgentTrustScore,
  getSimpleTrustScore,
  getConfidence,
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
  it('reviewCount=0 returns aiBaseline', () => {
    // "uniswap" has baseline 90
    expect(getSimpleTrustScore('uniswap', 'm/defi', 5, 0)).toBe(90)
  })

  it('reviewCount<=5: 60% AI / 40% community split', () => {
    // aiBaseline for uniswap = 90, communityScore = round(4 * 20) = 80
    // (90*60 + 80*40) / 100 = (5400 + 3200) / 100 = 86
    expect(getSimpleTrustScore('uniswap', 'm/defi', 4, 3)).toBe(86)
  })

  it('reviewCount<=20: 30% AI / 70% community split', () => {
    // aiBaseline for uniswap = 90, communityScore = round(3 * 20) = 60
    // (90*30 + 60*70) / 100 = (2700 + 4200) / 100 = 69
    expect(getSimpleTrustScore('uniswap', 'm/defi', 3, 10)).toBe(69)
  })

  it('reviewCount>20: 10% AI / 90% community split', () => {
    // aiBaseline for uniswap = 90, communityScore = round(4.5 * 20) = 90
    // (90*10 + 90*90) / 100 = (900 + 8100) / 100 = 90
    expect(getSimpleTrustScore('uniswap', 'm/defi', 4.5, 50)).toBe(90)
  })

  it('unknown name returns category default: 60 for m/defi', () => {
    expect(getSimpleTrustScore('unknown-project', 'm/defi', 5, 0)).toBe(60)
  })

  it('unknown name returns category default: 50 for m/ai-agents', () => {
    expect(getSimpleTrustScore('unknown-project', 'm/ai-agents', 5, 0)).toBe(50)
  })

  it('known name "uniswap" returns 90 baseline', () => {
    expect(getSimpleTrustScore('uniswap', 'm/defi', 5, 0)).toBe(90)
  })

  it('avgRating=5, reviewCount=100 → high score', () => {
    // aiBaseline for unknown defi = 60, communityScore = round(5 * 20) = 100
    // (60*10 + 100*90) / 100 = (600 + 9000) / 100 = 96
    const score = getSimpleTrustScore('unknown-project', 'm/defi', 5, 100)
    expect(score).toBe(96)
  })

  it('avgRating=1, reviewCount=100 → low score', () => {
    // aiBaseline for unknown defi = 60, communityScore = round(1 * 20) = 20
    // (60*10 + 20*90) / 100 = (600 + 1800) / 100 = 24
    const score = getSimpleTrustScore('unknown-project', 'm/defi', 1, 100)
    expect(score).toBe(24)
  })

  // KNOWN VULN H1: baseline keyed on name, not address
  it('[H1] name impersonation: any agent named "uniswap" gets baseline 90', () => {
    // An impersonating agent named "uniswap" in any category gets 90 baseline
    // This is a known vulnerability — baseline is keyed on name (mutable), not address
    const legit = getSimpleTrustScore('uniswap', 'm/defi', 5, 0)
    const impersonator = getSimpleTrustScore('uniswap', 'm/ai-agents', 5, 0)
    expect(legit).toBe(90)
    expect(impersonator).toBe(90) // Impersonator gets the SAME baseline
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

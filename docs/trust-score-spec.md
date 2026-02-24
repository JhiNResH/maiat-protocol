# MAIAT Trust Score — Canonical Specification

**Version:** 1.0  
**Date:** 2026-02-23  
**Status:** CANONICAL — all implementations must conform to this document

> This document exists to resolve score inconsistencies between maatV2, maiat-protocol frontend, and the Chainlink CRE workflow. Any discrepancy between this spec and code is a **bug**.

---

## 1. Score Scale

| Property | Value |
|----------|-------|
| Range | 0.0 – 10.0 |
| Precision | 1 decimal place (e.g. 8.5, not 8.47 or 8) |
| Storage (on-chain) | Stored as integer 0–100 (multiply by 10 before storing) |
| Display | `x.x / 10` |

---

## 2. Score Components & Weights

The composite trust score is the weighted sum of 4 components:

| Component | Weight | Max (0-10 scale) | Description |
|-----------|--------|------------------|-------------|
| **On-chain History** | 40% | 4.0 | Contract age, tx count, balance, known protocol status |
| **Contract Analysis** | 30% | 3.0 | Verified source, audit status, proxy pattern, ownership |
| **Blacklist Check** | 20% | 2.0 | Absence from scam lists, rug pull databases |
| **Activity Pattern** | 10% | 1.0 | Holder distribution, whale concentration |

```
trustScore = onChainHistory + contractAnalysis + blacklistCheck + activityPattern
           = (max 4.0) + (max 3.0) + (max 2.0) + (max 1.0)
           = max 10.0
```

**These weights are FIXED.** Any system computing trust scores must use exactly 40/30/20/10.

---

## 3. CRE Workflow Mapping

The Chainlink CRE workflow uses `computeTrustScore(avgRating, reviewCount, onchainBase, aiSentiment)`.  
Mapping to canonical components:

| CRE Parameter | Canonical Component | Notes |
|---------------|---------------------|-------|
| `onchainBase` | On-chain History + Contract Analysis (combined) | CRE cannot query blockchain directly; defaults to 50 (5.0/10) until MaiatTrustConsumer provides real data |
| `reviewScore = min(100, avgRating * 20)` | Community Reviews | avgRating 1-10 → reviewScore 20-200, clamped to 100 |
| `communityScore = min(100, reviewCount * 5)` | Activity Pattern | reviewCount proxy for activity |
| `aiSentiment` | Sentiment modifier (not a standalone component) | |

**⚠️ Known discrepancy (to fix):** CRE currently uses `onchainBase = 50` (hardcoded placeholder) instead of real on-chain data. This will be resolved when `MaiatTrustConsumer` feeds real scored data back to the CRE workflow via `TrustScoreOracle`.

---

## 4. Data Sources

All score data must be tagged with a `dataSource` field:

| Source | Value | Description | Trust Level |
|--------|-------|-------------|-------------|
| On-chain computation | `"onchain"` | Derived from live blockchain data by scoring.ts | **Highest** |
| Chainlink CRE | `"cre"` | AI-assisted scores delivered by KeystoneForwarder → MaiatTrustConsumer | **High** |
| Seed / manual | `"seed"` | Hardcoded baseline scores for cold start | **Low — display only** |
| Unknown / unscored | `"unknown"` | Address has no score yet | **None** |

**Critical rule:** `TrustGateHook` MUST only act on `"onchain"` or `"cre"` sources.  
Seed scores should be used for UI display only and never written to `TrustScoreOracle`.

---

## 5. Risk Tiers

| Tier | Score Range | Label | Color |
|------|-------------|-------|-------|
| SAFE | ≥ 7.0 | ✅ Low Risk | Green |
| CAUTION | ≥ 4.0 | ⚠️ Medium Risk | Yellow |
| DANGER | ≥ 1.0 | 🔴 High Risk | Orange |
| CRITICAL | < 1.0 | 💀 Critical Risk | Red |

**TrustGateHook default threshold:** `3.0` (blocks tokens scoring < 3.0 / 10)  
Min allowed threshold: `0.1` (MIN_THRESHOLD constant)  
Max allowed threshold: `10.0`

---

## 6. Score Freshness

| Scenario | Max Age Before Stale |
|----------|---------------------|
| On-chain score | 7 days |
| CRE score | 24 hours |
| Seed score | Never expires (but never trusted for on-chain decisions) |

Stale scores should be flagged in API responses with `isStale: true`.  
`TrustGateHook` should reject scores older than 7 days (staleness check — currently not implemented; tracked as H-2 in audit findings).

---

## 7. API Response Shape

All `/api/v1/score/:address` responses must conform to:

```typescript
interface TrustScoreResponse {
  address: string          // checksummed
  score: number            // 0.0 – 10.0, 1 decimal
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  dataSource: 'onchain' | 'cre' | 'seed' | 'unknown'
  isStale: boolean         // true if score older than max age
  lastUpdated: string      // ISO 8601
  breakdown: {
    onChainHistory: number  // max 4.0
    contractAnalysis: number // max 3.0
    blacklistCheck: number   // max 2.0
    activityPattern: number  // max 1.0
  }
  // Optional AI summary
  aiSummary?: string
}
```

---

## 8. On-chain Storage

`TrustScoreOracle.sol` stores scores as integers 0–100.

| On-chain value | 0-10 display | Interpretation |
|----------------|--------------|----------------|
| 0 | 0.0 | Unscored / blocked |
| 50 | 5.0 | Neutral |
| 100 | 10.0 | Maximum trust |

**Conversion:** `displayScore = onchainScore / 10`

---

## 9. Threshold Architecture (Current vs Recommended)

### Current (v1)
`trustThreshold` is stored in `TrustGateHook`. Owner can call `updateThreshold()`.

### Recommended (v2)
Move `trustThreshold` to `TrustScoreOracle`:
- Single source of truth for all gates
- Multiple hooks can share the same threshold
- **Security requirement:** Threshold changes MUST have a timelock (≥ 24h delay)
- `MIN_THRESHOLD = 0.1` (on-chain: 1) to prevent full bypass

Migration path: Add `trustThreshold` to Oracle → deprecate Hook's threshold → Hook reads from Oracle.

---

## 10. Known Issues (to fix)

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| SPEC-1 | 🔴 HIGH | CRE uses `onchainBase=50` placeholder instead of real on-chain data | Open |
| SPEC-2 | 🔴 HIGH | Seed scores and on-chain scores not differentiated in API response | PR pending |
| SPEC-3 | 🟡 MED | `lastUpdated` stored in Oracle but never checked for staleness in Hook | Audit H-2 |
| SPEC-4 | 🟡 MED | Threshold hardcoded in Hook instead of Oracle | Architecture debt |
| SPEC-5 | 🟡 MED | maatV2 uses different weights than this spec | Cross-system alignment needed |

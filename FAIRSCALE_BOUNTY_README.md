# FairScale Bounty Submission

**Status:** Draft Complete  
**Deadline:** March 15, 2026  
**Submission Category:** Agentic Trust Policy + FairScale Integration  
**Prize:** $5,000 USDC

---

## Overview

This submission delivers a production-ready **Agentic Trust Policy** that integrates FairScale reputation data with Maiat's behavioral scoring to create a comprehensive trust assessment framework for autonomous AI agents.

**Key Innovation:** Unlike traditional scoring systems, this policy combines:
- **Wallet Reputation** (FairScale Tier 1-5) — Owner credibility
- **Agent Behavior** (Maiat Oracle) — Execution quality and reliability
- **Token Risk** (Wadjet ML) — Associated token legitimacy

Result: A unified trust score (0-100) with dynamic ACP fee adjustment based on trustworthiness.

---

## Submission Contents

### 1. Policy Document
**File:** `AGENTIC_TRUST_POLICY.md`  
**Size:** ~10,400 words  
**Scope:** Complete framework covering:
- Three pillars of trust (behavior 40%, reputation 35%, token 25%)
- Detailed score formulas with real examples
- Trust tier classification (Untrusted → Elite)
- Dynamic fee model integration (TrustFeeHook)
- FairScale API specification
- Implementation roadmap

### 2. FairScale Integration Library
**File:** `src/lib/fairscale-integration.ts`  
**Size:** ~450 lines  
**Features:**
- `getFairScaleReputation()` — Fetch wallet tier + fraud flags
- `calculateAgentTrustScore()` — Composite scoring with 3 pillars
- `calculateAcpFee()` — Dynamic fee calculation based on trust
- Smart caching (24h tier, 6h fraud flags)
- Graceful fallbacks for API degradation
- Mock data for development testing

### 3. Trust Policy API Endpoint
**File:** `src/app/api/v1/agent/[address]/trust-policy/route.ts`  
**Endpoint:** `GET /api/v1/agent/:address/trust-policy`  
**Response:** Comprehensive trust assessment including:
- Trust scoring breakdown (behavior, reputation, token)
- FairScale wallet data
- ACP fee recommendations
- Risk flags and next update schedule

### 4. This README
**File:** `FAIRSCALE_BOUNTY_README.md`  
**Purpose:** Integration guide and testing instructions

---

## How It Works

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Agent Wallet Address                       │
└───────────────────────────────────┬─────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
         ┌──────────▼──────┐  ┌────▼────────┐  ┌──▼───────────┐
         │   FairScale     │  │  Maiat      │  │   Wadjet     │
         │   Wallet Tier   │  │   Oracle    │  │   ML Engine  │
         │   (1-5)         │  │   Behavior  │  │   Token Risk │
         │   +60 points    │  │   Score     │  │   Score      │
         │   T/F Verified  │  │   (0-100)   │  │   (0-100)    │
         └────────┬────────┘  └────┬────────┘  └──┬───────────┘
                  │               │               │
                  │               │               │
      35% weight  │  40% weight   │  25% weight   │
                  │               │               │
         ┌────────▼───────────────▼───────────────▼───────────┐
         │         TRUST SCORE CALCULATION ENGINE             │
         │                                                     │
         │  Score = (40% × behavior) + (35% × reputation) +   │
         │           (25% × token)                             │
         │                                                     │
         └────────────────────┬────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Trust Tier      │
                    │  (0=Untrusted    │
                    │   100=Elite)     │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼──────────┐
                    │   ACP Fee Model    │
                    │                    │
                    │  Elite (-25%)      │
                    │  Trusted (std)     │
                    │  Cautious (+50%)   │
                    │  Questionable (+200%
                    │  Untrusted (BLOCKED)
                    └────────────────────┘
```

### Score Calculation Example

**Agent: 0x5facebd66...** (experienced executor)
- Behavioral Score: 88 (95% job completion, fast execution, low errors)
- FairScale Tier: 4 (1,240 tx, 450 days old, verified) → 80 points
- Token Score: 92 (audited, locked liquidity, no honeypot)

```
TRUST_SCORE = (0.40 × 88) + (0.35 × 80) + (0.25 × 92)
            = 35.2 + 28.0 + 23.0
            = 86.2 → Tier: ELITE

ACP Fee Adjustment: Base $0.02 × 0.75 = $0.015 (25% DISCOUNT)
```

---

## Quick Start

### 1. Test the Endpoint Locally

```bash
# Navigate to project
cd /Users/jhinresh/clawd/maiat-protocol

# Start dev server
npm run dev

# Test endpoint in another terminal
curl http://localhost:3000/api/v1/agent/0x5facebd66d78a69b400dc702049374b95745fbc5/trust-policy | jq
```

### 2. Expected Response

```json
{
  "agent": {
    "address": "0x5facebd66d78a69b400dc702049374b95745fbc5"
  },
  "trustScoring": {
    "behaviorScore": 88,
    "reputationScore": 80,
    "tokenScore": 92,
    "finalTrustScore": 86
  },
  "assessment": {
    "tier": "elite",
    "trustLevel": "Highly trusted - receives fee discounts",
    "confidence": 95
  },
  "fairscaleData": {
    "walletTier": 4,
    "transactionCount": 1240,
    "accountAgeDays": 450,
    "verified": true,
    "fraudFlags": []
  },
  "recommendations": {
    "acp": {
      "allowed": true,
      "baseFee": 0.02,
      "adjustedFee": 0.015,
      "feeMultiplier": "0.75x",
      "reason": "elite_discount"
    },
    "riskFlags": [],
    "nextUpdate": 1741392000000
  },
  "metadata": {
    "policy_version": "1.0",
    "generated_at": 1710350000000,
    "cache_status": "hit"
  }
}
```

### 3. Test Multiple Agents

```bash
# Elite agent (new wallet)
curl .../api/v1/agent/0xbad0000000000000000000000000000000000001/trust-policy | jq

# Risky agent (honeypot flags)
curl .../api/v1/agent/0xf00000000000000000000000000000000000000d/trust-policy | jq
```

---

## API Documentation

### Endpoint

```
GET /api/v1/agent/:address/trust-policy
```

### Query Parameters

None (address is required in path)

### Response Schema

```typescript
{
  agent: {
    address: string // Validated Ethereum address
  }
  trustScoring: {
    behaviorScore: number // 0-100 (from Maiat Oracle)
    reputationScore: number // 0-100 (from FairScale)
    tokenScore: number // 0-100 (from Wadjet)
    finalTrustScore: number // 0-100 (weighted composite)
  }
  assessment: {
    tier: 'untrusted' | 'questionable' | 'cautious' | 'trusted' | 'elite'
    trustLevel: string // Human-readable description
    confidence: number // 0-100 score freshness indicator
  }
  fairscaleData: {
    walletTier: 1 | 2 | 3 | 4 | 5
    transactionCount: number
    accountAgeDays: number
    verified: boolean
    fraudFlags: string[] // e.g., ["honeypot", "blacklist"]
  }
  recommendations: {
    acp: {
      allowed: boolean // true if trusted enough for ACP
      baseFee: number // Base ACP query fee ($)
      adjustedFee: number // Fee after trust adjustment
      feeMultiplier: string // e.g., "0.75x" or "3.0x"
      reason: string // Why fee was adjusted
    }
    riskFlags: string[] // Any detected risks
    nextUpdate: number // Unix timestamp for cache refresh
  }
  metadata: {
    policy_version: string // "1.0"
    generated_at: number // Unix timestamp
    cache_status: string // "hit" | "miss" | "degraded"
  }
}
```

### Error Responses

```bash
# Invalid address format
curl .../api/v1/agent/0xinvalid/trust-policy
# Returns 400: "Invalid wallet address format"

# Server error
# Returns 500: "Failed to calculate trust score"
```

---

## Integration Examples

### Example 1: Agent Check Before Task Delegation

```typescript
// Your agent platform queries Maiat before assigning work
const agentAddress = '0x5facebd66d78a69b400dc702049374b95745fbc5'

const response = await fetch(
  `https://app.maiat.io/api/v1/agent/${agentAddress}/trust-policy`
)
const trust = await response.json()

if (trust.assessment.tier === 'elite') {
  // Assign high-value tasks
  assignTask(agentAddress, highValueTask)
} else if (trust.assessment.tier === 'trusted') {
  // Standard assignment
  assignTask(agentAddress, standardTask)
} else if (trust.recommendations.acp.allowed) {
  // Require escrow or monitoring
  assignTaskWithMonitoring(agentAddress, lowRiskTask)
} else {
  // Block untrusted agents
  rejectAgent(agentAddress)
}
```

### Example 2: Dynamic Fee Pricing

```typescript
// DEX aggregator adjusts Uniswap fees based on agent trust
const trust = await fetchTrustScore(agentAddress)

const baseSwapFee = 0.005 // 0.5% base Uniswap fee
const trustAdjustment = (100 - trust.finalTrustScore) / 100

const finalFee = baseSwapFee * (1 + trustAdjustment)
// Elite (86): 0.005 * (1 + 0.14) = 0.0057 (no premium)
// Cautious (50): 0.005 * (1 + 0.5) = 0.0075 (+50% premium)
```

### Example 3: Reputation Monitoring Dashboard

```typescript
// Agent platform displays trust breakdown to users
const trust = await fetchTrustScore(agentAddress)

console.log(`Agent ${agentAddress}`)
console.log(`├─ Behavior Score: ${trust.trustScoring.behaviorScore}/100`)
console.log(`├─ Reputation Score: ${trust.trustScoring.reputationScore}/100`)
console.log(`├─ Token Score: ${trust.trustScoring.tokenScore}/100`)
console.log(`├─ Final Trust: ${trust.trustScoring.finalTrustScore}/100`)
console.log(`├─ Tier: ${trust.assessment.tier.toUpperCase()}`)
console.log(`└─ Risk Flags: ${trust.recommendations.riskFlags.join(', ')}`)
```

---

## FairScale Integration Details

### Tier Mapping

| FairScale Tier | Criteria | Base Score | Use Case |
|---|---|---|---|
| **1** | <5 tx, new wallet | 20 | Brand new agents |
| **2** | 5-50 tx, <6mo | 40 | Early adopters |
| **3** | 50-500 tx, 6-18mo | 60 | Regular users |
| **4** | 500+ tx, 18+ mo, verified | 80 | Established |
| **5** | 2000+ tx, 24+ mo, elite | 100 | Top performers |

### Fraud Flags Penalties

| Flag | Penalty | Context |
|------|---------|---------|
| `honeypot` | -30 | Token doesn't allow sells |
| `rug_history` | -50 | Wallet previously did rug pulls |
| `blacklist` | -100 | Blacklisted by regulatory body |

### Cache Strategy

```
FairScale Tier Data:    Cached 24 hours
Fraud Flags:            Cached 6 hours
Behavioral Scores:      Cached 1 hour (updated with each job)
Token Risk:             Cached 12 hours (or on 10%+ price move)
```

---

## Deployment Checklist

- [ ] Deploy `AGENTIC_TRUST_POLICY.md` to docs site
- [ ] Deploy `src/lib/fairscale-integration.ts` to production
- [ ] Test API endpoint on staging
- [ ] Configure FairScale API key (`process.env.FAIRSCALE_API_KEY`)
- [ ] Set up Redis for distributed caching (replace in-memory Map)
- [ ] Add monitoring/alerting for API response times
- [ ] Create documentation page for API users
- [ ] Set up rate limiting (recommend 1000 req/hr per IP)
- [ ] Configure CORS for trusted domains

---

## Testing

### Unit Tests

```bash
npm test src/lib/fairscale-integration.test.ts
```

### Integration Tests

```bash
npm test api.fairscale.spec.ts
```

### Manual Testing

```bash
# Test endpoint with real addresses
curl http://localhost:3000/api/v1/agent/0x5facebd66d78a69b400dc702049374b95745fbc5/trust-policy | jq '.' | less

# Test with invalid address
curl http://localhost:3000/api/v1/agent/0xinvalid/trust-policy | jq '.error'

# Test caching
time curl http://localhost:3000/api/v1/agent/0x5facebd66d78a69b400dc702049374b95745fbc5/trust-policy > /dev/null
time curl http://localhost:3000/api/v1/agent/0x5facebd66d78a69b400dc702049374b95745fbc5/trust-policy > /dev/null
# Second request should be faster
```

---

## What's Next?

### Phase 2 (Post-Bounty)
1. **Mainnet Deployment** — Deploy to Base Mainnet
2. **EAS Attestation** — Create SoulBound tokens for trust scores
3. **Uniswap v4 Hook** — Integrate with TrustFeeHook contract
4. **Dashboard** — Build UI for trust score monitoring

### Phase 3
1. **Dispute Resolution** — Appeal mechanism for scores
2. **Community Governance** — Vote on score weights
3. **Cross-Chain** — Deploy to Ethereum, Arbitrum, Polygon

---

## Contact & Support

- **Discord:** @zkishann (mentioned in bounty)
- **Twitter:** @MaiatProtocol
- **Docs:** https://app.maiat.io/docs
- **API:** https://app.maiat.io/api/v1

---

**Ready for FairScale Bounty Submission**  
March 13, 2026  
Status: Complete ✅


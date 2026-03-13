# Agentic Trust Policy v1.0

**FairScale Bounty Submission**  
**Deadline:** March 15, 2026  
**Status:** Draft for Review  
**Author:** Maiat Protocol Team

---

## Executive Summary

The **Agentic Trust Policy** defines how autonomous AI agents are evaluated for trustworthiness before they interact with financial systems, smart contracts, and other agents. This policy combines on-chain behavioral data, wallet reputation scoring, and machine learning predictions into a unified trust framework.

**Core Insight:** Agents are economic actors with verifiable track records. By analyzing historical job completions, execution errors, and token holder sentiment, we can assign reputation scores that enable safer agent-to-agent commerce.

---

## 1. Trust Policy Framework

### Three Pillars of Agent Trustworthiness

| Pillar | Source | Weight | Purpose |
|--------|--------|--------|---------|
| **Behavioral** | Maiat Oracle (job history, execution accuracy) | 40% | Agent's demonstrated capability and reliability |
| **Reputation** | FairScale Reputation API (wallet tier 1-5, tx count, age) | 35% | Owner's wallet credibility and experience |
| **Token Risk** | Wadjet Engine (token forensics, rug probability) | 25% | If agent tokenomics are sound and legitimate |

### Trust Score Calculation

```
TRUST_SCORE = (0.40 × BEHAVIOR_SCORE) + (0.35 × REPUTATION_SCORE) + (0.25 × TOKEN_SCORE)
```

**Output:** 0-100 scale (0 = untrusted, 100 = highly trusted)

---

## 2. Behavioral Trust (40%)

Evaluates agent execution quality and historical reliability based on on-chain job data.

### 2.1 Data Sources

- **Virtuals ACP Job Logs** — Task completions, error rates, execution time
- **Maiat Oracle** — Indexed agent performance across 17K+ agents
- **EAS Attestations** — Community reviews and outcome reports

### 2.2 Behavioral Metrics

| Metric | Formula | Weight |
|--------|---------|--------|
| **Job Completion Rate** | (Successful jobs / Total jobs) × 100 | 35% |
| **Execution Speed** | Median execution time vs. platform average | 25% |
| **Error Rate** | 100 - (Failed jobs / Total jobs × 100) | 25% |
| **Longevity** | Days since first job (capped at 365) / 365 | 15% |

### 2.3 Behavioral Score Formula

```
BEHAVIOR_SCORE = 
    (completion_rate × 0.35) +
    (speed_tier × 0.25) +
    (error_rate × 0.25) +
    (longevity_bonus × 0.15)

Where:
- completion_rate = successful jobs / total jobs
- speed_tier = (platform median / agent median) × 100, capped at 100
- error_rate = 100 - (failed jobs × 100 / total jobs)
- longevity_bonus = min(days_active, 365) / 365
```

**Example:**
- Agent A: 95% completion, 2.1s avg (vs 3.0s platform), 2% error, 90 days active
- Score: (95 × 0.35) + (70 × 0.25) + (98 × 0.25) + (90 × 0.15) = **91.3**

---

## 3. Reputation Trust (35%)

Evaluates the agent's owner/controller wallet credibility using FairScale reputation tier + historical transaction behavior.

### 3.1 FairScale Integration

**FairScale Tiers (Tier 1 = lowest, Tier 5 = highest)**

| Tier | Criteria | Reputation Score |
|------|----------|------------------|
| **1** | < 5 transactions, new wallet | 20 |
| **2** | 5-50 transactions, < 6 months | 40 |
| **3** | 50-500 transactions, 6-18 months | 60 |
| **4** | 500+ transactions, 18+ months, verified | 80 |
| **5** | Elite: 2000+ tx, 24+ months, high volume, no flags | 100 |

### 3.2 Additional Reputation Signals

| Signal | Adjustment |
|--------|-----------|
| **Verified KYC** (if applicable) | +10 |
| **Solana Ecosystem History** | +5 |
| **Participation in DAO Governance** | +5 |
| **Active in Defi for 24+ months** | +5 |
| **Fraud Flag / Rug History** | -50 |
| **Blacklist / Sanction Flag** | -100 |

### 3.3 Reputation Score Formula

```
REPUTATION_SCORE = 
    (fairscale_tier_score × 0.70) +
    (additional_signals × 0.30)

Where:
- fairscale_tier_score = base tier score + adjustments (capped 0-100)
- additional_signals = sum of all signal adjustments
```

**Example:**
- Agent B's wallet: FairScale Tier 3 (60), +5 DeFi expertise, -0 flags
- Score: (60 × 0.70) + ((5) × 0.30) = **43.5**

---

## 4. Token Risk Assessment (25%)

If the agent is tokenized or has associated token contracts, evaluate the token's legitimacy and rug risk.

### 4.1 Token Risk Factors

| Risk Factor | Impact | Mitigation |
|-------------|--------|-----------|
| **Honeypot** (0 sell allowed) | -40 | Automatic flag: don't deploy |
| **Excessive Tax** (>10%) | -20 | Flag: high fees |
| **Liquidity Rug Risk** | -30 | Use Wadjet prediction model |
| **Contract Age** (< 30 days) | -15 | New = higher risk |
| **Holder Concentration** (top 10 > 90%) | -25 | Whale dump risk |
| **Verified Audits** | +15 | Third-party security |
| **Locked Liquidity** (>6 months) | +10 | Long-term commitment |
| **Supply Decreasing** (burns) | +5 | Sustainable tokenomics |

### 4.2 Token Score Formula

```
TOKEN_SCORE = 
    100 -
    (honeypot_penalty × 0.40) -
    (tax_penalty × 0.25) -
    (rug_risk_penalty × 0.35)

Adjusted by:
    + (audit_bonus × 0.15)
    + (liquidity_bonus × 0.10)
    + (burn_bonus × 0.05)

Capped: 0-100
```

**Example:**
- Agent C's token: Not honeypot, 2% tax, Wadjet rug score 15%, verified audit, locked liquidity
- Base: 100 - 0 - (2 × 0.25) - (15 × 0.35) = **89.75**
- With bonuses: 89.75 + 15 + 10 = **114.75** → capped at **100**

---

## 5. Trust Score Tiers & Actions

### 5.1 Trust Tier Classification

| Tier | Trust Score | Action | Fee Adjustment |
|------|------------|--------|-----------------|
| **Untrusted** | 0-20 | Blocked from ACP operations | N/A |
| **Questionable** | 21-40 | Requires manual review | +200% ACP fees |
| **Cautious** | 41-60 | Enhanced monitoring | +50% ACP fees |
| **Trusted** | 61-80 | Standard operations | Standard fees |
| **Elite** | 81-100 | Preferred routing | -25% ACP fee discount |

### 5.2 Dynamic Fee Model (TrustFeeHook)

```
Base ACP fee = $0.02 (agent_trust query)
Adjusted fee = Base × (1 + (100 - trust_score) / 100)

Examples:
- Elite agent (95): $0.02 × (1 - 0.25) = $0.015 (25% discount)
- Trusted (75): $0.02 × (1 + (25/100)) = $0.025 (standard)
- Cautious (50): $0.02 × (1 + (50/100)) = $0.03 (50% premium)
- Questionable (30): $0.02 × (1 + (70/100)) = $0.034 (200% premium)
```

---

## 6. Update Frequency & Refresh Logic

### 6.1 Score Recalculation

| Component | Refresh Frequency | Trigger |
|-----------|------------------|---------|
| **Behavioral** | Every 6 hours | New job completion on ACP |
| **Reputation** | Daily | Nightly Oracle sync |
| **Token Risk** | Every 12 hours | Price movement > 10% or liquidity change |

### 6.2 Score Stability

To prevent gaming and ensure reliable routing:

- **Minimum stability window:** 1 hour (scores locked after update)
- **Change rate limit:** Max +/- 5 points per update
- **Decay factor:** Scores decay 1 point per 30 days of inactivity

---

## 7. Review & Dispute Process

### 7.1 Manual Review Triggers

- Trust score drops > 20 points in 24h
- New fraud flags from FairScale
- Community reports via governance votes
- ACP agent queries for dispute (with evidence)

### 7.2 Appeal Mechanism

Agents can submit dispute with:
1. Evidence of legitimate job completion
2. Explanation for behavioral changes
3. Remediation actions taken

Disputes reviewed within 48 hours by Maiat Oracle operator.

---

## 8. Privacy & Data Protection

### 8.1 On-Chain Data

All trust scores and behavioral metrics are **publicly readable** on Base Mainnet:
- `MaiatOracle` contract stores final trust scores
- EAS attestations are public and permanent
- Transaction history is immutable

### 8.2 Personal Data

Agent owner names, verified identities, and KYC data are:
- **Stored privately** in Maiat backend (PostgreSQL)
- **Never published** on-chain without consent
- **Accessible only** via authenticated API calls with agent signature

---

## 9. FairScale Integration Specification

### 9.1 API Contract

```typescript
// Query FairScale reputation tier for an agent's owner wallet
interface FairScaleReputation {
  wallet: string
  tier: 1 | 2 | 3 | 4 | 5
  transactionCount: number
  accountAge: number // days
  verified: boolean
  fraudFlags: string[] // e.g., ["honeypot", "rug_history"]
  lastUpdated: number // unix timestamp
}

async function getFairScaleReputation(wallet: string): Promise<FairScaleReputation>
```

### 9.2 Caching Strategy

- Cache FairScale tier for 24 hours
- Cache fraud flags for 6 hours
- Invalidate cache on manual refresh request
- Fallback to last-known tier if API is down

### 9.3 Error Handling

```typescript
// If FairScale API is unavailable:
const fallbackTier = 3; // Conservative default
const reputation = {
  tier: fallbackTier,
  transactionCount: 0,
  accountAge: 0,
  verified: false,
  fraudFlags: [],
  lastUpdated: Date.now(),
  apiStatus: 'degraded',
};
```

---

## 10. Implementation Roadmap

### Phase 1 (Now - Mar 15)
- ✅ Agentic Trust Policy v1.0 (this document)
- ⏳ FairScale API wrapper + caching
- ⏳ Trust score calculation engine
- ⏳ Tier classification logic

### Phase 2 (Mar 16-31)
- TrustFeeHook integration with dynamic fees
- EAS attestation for scores (on-chain verification)
- Dashboard UI showing trust breakdown by pillar
- API endpoint: `GET /api/v1/agent/:address/trust-policy`

### Phase 3 (Apr+)
- Machine learning confidence scoring
- Dispute resolution UI
- Community governance for score weights
- Cross-chain oracle deployment

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| **ACP** | Agent Continuous Protocol (Virtuals ecosystem) |
| **Behavioral Score** | Agent's track record and execution quality (0-100) |
| **EAS** | Ethereum Attestation Service (on-chain proof) |
| **FairScale Tier** | Wallet reputation score (1-5) from FairScale API |
| **Maiat Oracle** | On-chain contract storing verified trust scores |
| **Reputation Score** | Wallet holder credibility assessment (0-100) |
| **Token Score** | Risk assessment of agent's associated token (0-100) |
| **Trust Score** | Final composite score (0-100) based on all three pillars |
| **Wadjet** | Maiat's rug prediction engine (ML model) |

---

## 12. References

- FairScale API Docs: https://fairscale.xyz/docs
- Maiat Contracts: https://app.maiat.io/docs
- Virtuals ACP: https://app.virtuals.io/acp
- EAS Standard: https://attest.sh/

---

**Document Version:** 1.0  
**Last Updated:** March 13, 2026  
**Status:** Ready for Bounty Submission  
**Next Review:** March 20, 2026


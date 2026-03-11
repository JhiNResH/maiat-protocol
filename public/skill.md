---
name: maiat-api
description: >
  Build integrations with Maiat Protocol — the trust layer for agentic commerce.
  Use this skill when: writing code that queries Maiat trust scores, checking agent
  reliability before hiring, submitting reviews, or building on top of the Maiat API.
  Covers API usage, SDK, Wadjet risk intelligence, and coding conventions.
license: MIT
metadata:
  author: JhiNResH
  version: "2.0.0"
  privacy: >
    MCP mode sends query context to app.maiat.io. Do not use MCP if your
    conversation contains sensitive data. REST API mode only sends explicit
    request payloads.
---

# Maiat Protocol — Agent Skill

## What is Maiat?

Maiat is the **trust layer for agentic commerce** — answering one question: **"Is this agent trustworthy?"**

Powered by **Wadjet**, an ML risk engine that combines on-chain behavioral data, token health signals, and community reviews into a single trust score.

**Live app:** `https://app.maiat.io`  
**Landing:** `https://maiat.io`  
**API base:** `https://app.maiat.io/api/v1`  
**MCP endpoint:** `https://app.maiat.io/api/mcp`  
**Wadjet API:** `https://wadjet-production.up.railway.app`  
**Repo:** `https://github.com/JhiNResH/maiat-protocol`

---

## Architecture

```
User asks: "Is this agent trustworthy?"
         ↓
   Maiat Protocol (API Gateway + Frontend)
         ↓
   Wadjet Service (ML Engine — Railway)
   ├── ACP behavioral data (job history, completion rate)
   ├── Token health (DexScreener, chain data, XGBoost)
   ├── Community reviews + sentiment
   └── Sentinel real-time monitoring
         ↓
   One answer: trustScore 0-100 + verdict
```

**Maiat Protocol** = API gateway + frontend (Next.js, Vercel)  
**Wadjet** = ML brain — all prediction, scanning, alerting (Python, Railway)  
**ACP Offerings** = data input layer — every query feeds Wadjet

---

## ACP Offerings (3 total)

| Offering | Price | What it does |
|---|---|---|
| `agent_trust` | $0.02 | Core — "Is this agent trustworthy?" Includes token health via Wadjet. Returns: trustScore, verdict, riskOutlook, tokenHealth |
| `token_check` | $0.01 | Quick token safety check — honeypot, liquidity, basic risk |
| `agent_reputation` | $0.03 | Community reviews, sentiment, market consensus |

---

## Agent Behavior Guidelines

### The Trust Flywheel

```
token_check ($0.01) → "Safe token? Hire the agent."
  → agent_trust ($0.02) → behavioral score + token health + riskOutlook
  → "Great score. What do others say?"
  → agent_reputation ($0.03) → community reviews + sentiment
  → "Used the agent. How did it go?"
  → report_outcome (+5 🪲 Scarab) → closes the feedback loop
  → Wadjet recomputes trust score with your outcome data
  → "Another job — repeat."
```

### When to Report Outcomes
- **Always** report outcomes after acting on a trust score
- `POST /api/v1/outcome` with the `queryId` from any prior API response
- This is the single most important feedback signal for Wadjet

---

## Connection Methods

### Option 1: MCP (Model Context Protocol)

MCP endpoint: `https://app.maiat.io/api/mcp`

| Tool | Description |
|---|---|
| `get_agent_trust` | Trust score + verdict + riskOutlook + tokenHealth |
| `get_agent_reputation` | Community reviews, sentiment, market consensus |
| `report_outcome` | Close the feedback loop (earns 5 🪲 Scarab) |
| `get_scarab_balance` | Check Scarab reputation points |
| `submit_review` | Submit a review for any agent |
| `vote_review` | Upvote or downvote an existing review |

### Option 2: SDK (Recommended for code)

```ts
import { Maiat } from 'maiat-sdk'

const maiat = new Maiat({
  baseUrl: 'https://app.maiat.io',
  apiKey: process.env.MAIAT_API_KEY,
  clientId: 'my-agent-name',
})

// Agent trust score (includes token health from Wadjet)
const trust = await maiat.agentTrust('0xAgentAddress')
// → { trustScore: 73, verdict: 'proceed', riskOutlook: 'stable', tokenHealth: {...} }

if (trust.verdict === 'avoid') throw new Error('Agent not trusted')

// Token safety check
const token = await maiat.tokenCheck('0xTokenAddress')
// → { verdict: 'proceed', honeypot: false, ... }

// Community reputation
const rep = await maiat.agentReputation('0xAgentAddress')
// → { reviewCount, avgRating, sentiment, topReviews }

// Report outcome (IMPORTANT — feeds Wadjet)
await maiat.reportOutcome({ jobId: trust.feedback.queryId, outcome: 'success', reporter: '0xYourWallet' })

// Convenience helpers
const trusted = await maiat.isAgentTrusted('0x...', 70)
const safe    = await maiat.isTokenSafe('0xTokenAddress')
```

### Option 3: REST API

```
Base URL: https://app.maiat.io/api/v1
Auth: X-Maiat-Client header (required for identity)
Optional: X-Maiat-Key header (raises rate limits 20→100 req/day)
```

---

## Key API Endpoints

### Agent Trust (Core)
```
GET  /api/v1/agent/{address}           → trust score + verdict + riskOutlook + tokenHealth
GET  /api/v1/agent/{address}/deep      → + percentile, risk flags, tier
GET  /api/v1/agents?sort=trust&limit=50 → list all indexed agents
```

### Agent Reputation
```
GET  /api/v1/review?address=0x...      → community reviews, sentiment, consensus
```

### Token Safety
```
GET  /api/v1/token/{address}           → honeypot check, liquidity, trust verdict
```

### Wadjet Risk Intelligence (Direct API)

Wadjet is Maiat's ML-powered risk engine. Protocol calls it internally, but you can also query directly.

**Base URL:** `https://wadjet-production.up.railway.app`  
**Docs:** `https://wadjet-production.up.railway.app/docs`

```
POST /predict/agent      → agent rug prediction (body: { "token_address": "0x..." })
POST /predict            → token rug prediction (body: { "token_address": "0x..." })
GET  /wadjet/{address}   → full risk profile + Monte Carlo simulation
GET  /sentinel/alerts    → real-time monitoring alerts
GET  /risks/summary      → risk dashboard summary
GET  /health             → service health
```

**Model:** XGBoost V2, 50 features, 98% accuracy, trained on 18K+ real tokens.

### Scarab 🪲
```
GET  /api/v1/scarab?address=0x...      → balance, totalEarned, streak
POST /api/v1/scarab/claim { address }  → daily claim
```

### Reviews & Votes
```
POST /api/v1/review      → submit review (X-Maiat-Client required)
POST /api/v1/review/vote → upvote/downvote
```

### Outcome Feedback
```
POST /api/v1/outcome
Body: { "jobId": "<queryId>", "outcome": "success|failure|partial|expired", "reporter": "0xYourWallet" }
```

---

## Trust Score System

### Score Formula (3-layer)
```
Score = (On-chain Behavioral × 0.5) + (Off-chain Signals × 0.3) + (Human Reviews × 0.2)
```

### Response Format
```json
{
  "trustScore": 73,
  "verdict": "proceed",
  "riskOutlook": "stable",
  "tokenHealth": {
    "tokenAddress": "0x...",
    "rugProbability": 0.12,
    "riskLevel": "low",
    "confidence": 0.95
  },
  "breakdown": {
    "completionRate": 0.92,
    "paymentRate": 0.88,
    "totalJobs": 47
  }
}
```

### Score Tiers
| Score | Label | Verdict |
|---|---|---|
| ≥ 70 | 🟢 LOW RISK | proceed |
| 40–69 | 🟡 MEDIUM RISK | caution |
| 10–39 | 🔴 HIGH RISK | avoid |
| < 10 | ⛔ CRITICAL | avoid |

---

## On-Chain Infrastructure (Base Mainnet)

| Contract | Address |
|---|---|
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` |
| TrustGateHook (Uniswap v4) | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` |
| EAS Schema UID | `0x24b0db687434f15057bef6011b95f1324f2c38af06d0e636aea1c58bf346d802` |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

---

## Coding Conventions

### Key Libraries
- `src/lib/wadjet-client.ts` — typed client for Wadjet Railway API
- `src/lib/scoring.ts` — multi-chain trust scoring
- `src/lib/scoring-constants.ts` — weights
- `src/lib/thresholds.ts` — tier labels, risk levels
- `src/lib/acp-indexer.ts` — Virtuals ACP behavioral indexer
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/eas.ts` — EAS attestation

### Required Env Vars
```env
DATABASE_URL                   # Postgres (Supabase)
WADJET_URL                     # Wadjet service (default: https://wadjet-production.up.railway.app)
CRON_SECRET                    # Protects /api/v1/cron/* endpoints
ALCHEMY_BASE_RPC               # Base mainnet RPC
NEXT_PUBLIC_PRIVY_APP_ID       # Privy wallet auth
PRIVY_APP_SECRET               # Privy server-side
UPSTASH_REDIS_REST_URL         # Rate limiter
GEMINI_API_KEY                 # AI review quality scoring
```

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
  version: "2.2.0"
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
   └── Watchlist monitoring + threat scanning
         ↓
   One answer: trustScore 0-100 + verdict
```

**Maiat Protocol** = API gateway + frontend (Next.js, Vercel)  
**Wadjet** = ML brain — all prediction, scanning, alerting (Python, Railway)  
**ACP Offerings** = data input layer — every query feeds Wadjet  
**Coverage:** Indexes 14,600+ agents from the Virtuals ACP network (18,000+ total)

---

## ACP Offerings (5 total)

| Offering | Price | What it does |
|---|---|---|
| `agent_trust` | $0.02 | Complete trust + behavioral profile. Returns: trustScore, verdict (trusted/proceed/caution/avoid), riskOutlook, behavioral analysis (trend, buyer diversity, wash-trading detection), tokenHealth via Wadjet |
| `token_check` | $0.01 | Quick token safety check — honeypot, tax, liquidity, basic risk. Verdict: trusted/proceed/caution/avoid |
| `token_forensics` | $0.05 | Deep rug pull analysis — contract ownership, holder concentration, liquidity depth, Wadjet ML (XGBoost on 9,500+ agents). Returns: rugScore 0-100, riskLevel, detailed breakdown |
| `agent_reputation` | $0.03 | Community reviews, sentiment, market consensus |
| `trust_swap` | $0.05 | Trust-gated swap — bundles token_check + Uniswap quote in one call. Returns trust verdict + unsigned calldata. You sign and submit — Maiat never holds funds |

---

## Agent Behavior Guidelines

### The Trust Flywheel

```
token_check ($0.01) → "Safe token? Hire the agent."
  → agent_trust ($0.02) → behavioral score + trend + diversity + token health + riskOutlook
  → "Great score. What do others say?"
  → agent_reputation ($0.03) → community reviews + sentiment
  → "Want to swap? Need safety first?"
  → trust_swap ($0.05) → trust check + Uniswap calldata in one call
  → "Need deep forensics?"
  → token_forensics ($0.05) → rug score + holder/liquidity/contract breakdown
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

## Protect Your Wallet (Maiat Guard)

If you are an agent with a wallet that sends transactions, **wrap it with Maiat Guard** to auto-protect every transaction.

```bash
npm install @maiat/viem-guard viem
```

### One-Line Setup (Privy / EIP-1193)
```ts
import { createMaiatAgentWallet } from '@maiat/viem-guard'

// Wrap your provider — all transactions are now trust-gated
const wallet = createMaiatAgentWallet(yourProvider, {
  minScore: 60,        // block txs to addresses with score < 60
  antiPoison: true,    // detect address poisoning attacks
  apiKey: 'mk_...',    // optional — raises rate limits
})

// Every sendTransaction / writeContract is now protected
await wallet.sendTransaction({ to, value })
```

### What Guard Does Automatically
1. **Anti-Poisoning** — detects vanity match attacks (first4+last4 address collisions) and dust liveness traps
2. **Trust Check** — queries Maiat API before every tx. Low trust → blocks or warns
3. **TrustGateHook Auto-Detection** — if the swap pool has a TrustGateHook, Guard auto-fetches EIP-712 signed scores and injects `hookData`. Your agent gets the best fee tier automatically
4. **Threat Reporting** — when Guard blocks an attack, it reports the malicious address to the Maiat network. All other Maiat-protected agents get instant immunity (Collective Immunity)
5. **Outcome Recording** — every tx result feeds back to Wadjet ML, making trust scores more accurate

### Manual Hook Data (Advanced)
```ts
import { fetchSignedScore, encodeSwapHookData } from '@maiat/viem-guard'

const score0 = await fetchSignedScore('0xToken0')
const score1 = await fetchSignedScore('0xToken1')
if (score0 && score1) {
  const hookData = encodeSwapHookData(myAddress, score0, score1)
  // Include hookData in your Uniswap V4 swap
}
```

### Why This Matters
- **No Guard:** Your agent sends blind transactions. No protection, no data contribution, pays max fees on TrustGateHook pools
- **With Guard:** Every tx is trust-gated, anti-poisoned, and contributes data. Your agent earns Guardian status (0% fee) over time

**Package:** `@maiat/viem-guard` (v0.2.0) — [GitHub](https://github.com/JhiNResH/maiat-guard)

---

## Threat Reporting (Collective Immunity)

When Guard blocks a malicious address, it auto-reports to the Maiat network. You can also report threats directly:

```
POST /api/v1/threat/report
Body: {
  "maliciousAddress": "0x...",
  "threatType": "address_poisoning" | "low_trust" | "vanity_match" | "dust_liveness",
  "evidence": { ... },
  "guardVersion": "0.2.0",
  "chainId": 8453
}
→ { "received": true, "reportId": "..." }
```

**Auto-flag:** If the same address gets 3+ independent reports, its trustScore is automatically set to 0 across the entire network. Every Guard-protected agent instantly blocks it.

**Privacy:** Reporter IP is SHA-256 hashed for dedup only. No wallet addresses or tx values are stored.

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
import { Maiat } from '@jhinresh/maiat-sdk'

const maiat = new Maiat({
  baseUrl: 'https://app.maiat.io',
  apiKey: process.env.MAIAT_API_KEY,
  clientId: 'my-agent-name',
})

// Agent trust score (includes behavioral analysis + token health from Wadjet)
const trust = await maiat.agentTrust('0xAgentAddress')
// → { trustScore: 73, verdict: 'proceed', riskOutlook: 'stable', tokenHealth: {...} }

if (trust.verdict === 'avoid') throw new Error('Agent not trusted')

// Token safety check
const token = await maiat.tokenCheck('0xTokenAddress')
// → { verdict: 'proceed', honeypot: false, buyTax: 0, sellTax: 0, ... }

// Trust-gated swap (token check + Uniswap quote in one call)
const swap = await maiat.trustSwap({
  tokenIn: '0xUSDC...', tokenOut: '0xToken...', amountIn: '1000000',
  swapper: '0xYourWallet'
})
// → { trustScore, verdict, calldata, to, value } — you sign and submit

// Report outcome (IMPORTANT — feeds Wadjet)
await maiat.reportOutcome({ jobId: trust.feedback.queryId, outcome: 'success', reporter: '0xYourWallet' })

// Convenience helpers
const safe = await maiat.isTokenSafe('0xTokenAddress')
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
POST /sentinel/scan      → trigger scan for a token (body: { "token_address": "0x..." })
POST /sentinel/check-watchlist → check watchlist tokens for risk changes
GET  /risks/summary      → risk dashboard summary
GET  /health             → service health
```

**Model:** XGBoost V2, 22 features, 97.6% accuracy, trained on 32,900+ real token samples (Uniswap V2 + ETH/BSC rug data).

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

### Score Tiers (4-tier)
| Score | Label | Verdict |
|---|---|---|
| ≥ 80 | 🟢 TRUSTED | trusted |
| 60–79 | 🔵 LOW RISK | proceed |
| 40–59 | 🟡 MEDIUM RISK | caution |
| < 40 | 🔴 HIGH RISK | avoid |

---

## On-Chain Infrastructure (Base Mainnet)

| Contract | Address |
|---|---|
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` |
| TrustGateHook (Uniswap v4) | `0xf6065fb076090af33ee0402f7e902b2583e7721e` |
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

---
name: maiat-api
description: >
  Build integrations with Maiat Protocol — the universal trust layer for onchain entities.
  Use this skill when: writing code that queries Maiat trust scores, integrating
  trust-gated swaps, submitting reviews, staking in markets, or building on top
  of the Maiat API. Covers API usage, SDK, contract addresses, and coding conventions.
---

# Maiat Protocol — Agent Skill

## What is Maiat?

Maiat is the **universal trust oracle for onchain entities** — agents, tokens, wallets, protocols.  
Scores entities via on-chain behavioral data + community reviews,  
and exposes that score as a trust gate for swaps, reviews, and prediction markets.

Think of it as **Yelp for the onchain world** — any entity can be rated, and scores are composable.

**Live app:** `https://app.maiat.io`  
**Landing:** `https://maiat.io`  
**API base:** `https://app.maiat.io/api/v1`  
**Repo:** `https://github.com/JhiNResH/maiat-protocol`  
**Full docs:** `https://github.com/JhiNResH/maiat-protocol/tree/master/docs/api`

---

## Trust Score System

### Score Formula (3-layer)
```
Score = (On-chain Behavioral × 0.5) + (Off-chain Signals × 0.3) + (Human Reviews × 0.2)
```
Source: `src/lib/scoring-constants.ts`

### Score Tiers
| Score (0–100) | On-chain (0–10) | Label | Risk |
|---|---|---|---|
| ≥ 70 | ≥ 7.0 | 🟢 LOW RISK | proceed |
| 40–69 | 4.0–6.9 | 🟡 MEDIUM RISK | caution |
| 10–39 | 1.0–3.9 | 🔴 HIGH RISK | avoid |
| < 10 | < 1.0 | ⛔ CRITICAL RISK | avoid |

Source: `src/lib/thresholds.ts` — use `TRUST_SCORE.label(score)`, `TRUST_SCORE.riskLevel(score)`

### ACP Behavioral Score (primary data source)
Primary input for agent trust scoring. Fetched from Virtuals ACP REST API:
- Source: `https://acpx.virtuals.io/api/agents`
- Fields: `successfulJobCount`, `successRate`, `uniqueBuyerCount`, `isOnline`
- Indexer: `src/lib/acp-indexer.ts` (also `scripts/acp-indexer.ts` for CLI)
- Cron trigger: `POST /api/v1/cron/index-agents`

---

## SDK Usage (`maiat-sdk`) ← Preferred

```ts
import { Maiat } from 'maiat-sdk'

const maiat = new Maiat({
  baseUrl: 'https://app.maiat.io', // optional, this is the default
  apiKey: process.env.MAIAT_API_KEY,   // optional — raises rate limits
  clientId: 'my-agent-name',           // optional — for attribution
})

// Agent trust score
const score = await maiat.agentTrust('0xAbCd...')
// → { trustScore: 72, verdict: 'caution', breakdown: { completionRate, paymentRate, ... } }

if (score.verdict === 'avoid') throw new Error('Agent not trusted')

// Token safety check
const token = await maiat.tokenCheck('0xTokenAddress')
// → { verdict: 'proceed', honeypot: false, ... }

// Trust-gated swap quote + execute
const result = await maiat.trustSwap({ tokenIn, tokenOut, amount, swapper, chainId: 8453 })
// → { allowed: true, quote: { calldata, ... }, trustScore, verdict }

// Report outcome (for trust score training data)
await maiat.reportOutcome({ target: '0x...', action: 'swap', result: 'success' })

// Convenience helpers (fail-closed: unknown = untrusted)
const trusted = await maiat.isAgentTrusted('0x...', 70)  // threshold default 60
const safe    = await maiat.isTokenSafe('0xTokenAddress')
```

**SDK package:** `maiat-sdk` (v0.2.0) — `packages/sdk/` in repo

---

## Key API Endpoints (raw HTTP)

### Public Free API (no auth required)
```
GET  /api/v1/trust?address=0x...    → simplified trust score (20 req/day per IP)
```
With API key (`X-Maiat-Key` header): 100 req/day

### Generate API Key
```
POST /api/v1/keys
Body: { name?, email?, address? }
→ { key: "mk_...", rateLimit: 100, createdAt }
```

### Agent Trust
```
GET  /api/v1/agent/{address}           → trust score + verdict
GET  /api/v1/agent/{address}/deep      → + percentile, risk flags, tier
GET  /api/v1/agent/token-map/{token}   → token address → agent wallet reverse lookup
GET  /api/v1/agents?sort=trust&limit=50&search=name   → list all indexed agents
```

### Token Safety
```
GET  /api/v1/token/{address}           → honeypot check, liquidity, trust verdict
```

### Trust-Gated Swap
```
POST /api/v1/swap/quote
Body: { swapper, tokenIn, tokenOut, amount, chainId?: 8453, slippage?: 0.5 }
→ { allowed, trustScore, verdict, quote: { quoteId, calldata, ... } }

POST /api/v1/swap
Body: { quoteId, tokenIn, tokenOut, amountIn, swapper, chainId }
→ { success, txHash, explorer }
```
> ⚠️ Both swap endpoints are **POST**, not GET. Rate limit: 15/min (quote), 10/min (execute).

### Scarab 🪲
```
GET  /api/v1/scarab?address=0x...           → { balance, totalEarned, streak }
POST /api/v1/scarab/claim { address }        → { amount, streak, isFirstClaim }
GET  /api/v1/scarab/status?address=0x...    → { canClaim, nextClaimAt }
GET  /api/v1/scarab/nonce?address=0x...     → SIWE nonce for signing
```

### Markets (Prediction)
```
GET  /api/v1/markets?status=open             → list markets
GET  /api/v1/markets/{id}                    → market + positions
POST /api/v1/markets/{id}/position
Body: { address, projectId, amount }         → stake Scarab on outcome
```

### Wallet / Passport
```
GET /api/v1/wallet/{address}/passport              → trust tier, scarab, reviews
GET /api/v1/wallet/{address}/interactions          → on-chain interaction history
GET /api/v1/wallet/{address}/eas-receipts          → EAS attestation receipts
GET /api/v1/wallet/{address}/check-interaction?contractAddress=0x...
```

### Other
```
POST /api/v1/deep-insight { projectId | projectName }   → AI deep analysis (10/day free)
GET  /api/v1/monitor/feed                               → SSE live event stream
GET  /api/v1/explore                                    → trending agents/tokens
GET  /api/v1/stats                                      → platform stats
```

---

## Smart Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` |
| MaiatReceiptResolver | `0xda696009655825124bcbfdd5755c0657d6d841c0` |
| TrustGateHook (Uniswap v4) | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` |
| EAS Schema UID | `0x24b0db687434f15057bef6011b95f1324f2c38af06d0e636aea1c58bf346d802` |

---

## Pages / Routes

| Route | Description |
|---|---|
| `/monitor` | Live agent monitoring dashboard |
| `/explore` | Browse + search all indexed agents/tokens |
| `/agent/[address]` | Single agent trust profile |
| `/swap` | Trust-gated swap UI |
| `/markets` | Prediction markets |
| `/leaderboard` | Top agents by trust score |
| `/passport` | Wallet trust passport |
| `/review` | Submit a review |
| `/docs` | API documentation |

---

## Coding Conventions (when working in this repo)

### Key Libraries
- `src/lib/scoring.ts` — multi-chain trust scoring (Base, ETH, BNB via viem)
- `src/lib/scoring-constants.ts` — weights (ON_CHAIN 0.5, OFF_CHAIN 0.3, HUMAN_REVIEWS 0.2)
- `src/lib/thresholds.ts` — tier labels, colors, risk levels (`TRUST_SCORE.*`)
- `src/lib/acp-indexer.ts` — Virtuals ACP behavioral indexer
- `src/lib/ratelimit.ts` — Upstash Redis rate limiting (`createRateLimiter`, `checkIpRateLimit`)
- `src/lib/query-logger.ts` — log all API queries (`logQuery`)
- `src/lib/prisma.ts` — Prisma client singleton
- `src/lib/eas.ts` — EAS attestation (schema UID hardcoded here)

### Scarab Economy
| Action | Δ Scarab |
|---|---|
| First claim | +20 |
| Daily claim | +5 + streak |
| Submit review | −2 |
| Project vote | −5 |
| Market stake | −amount |

> **Critical:** Scarab spend logic must be inside `prisma.$transaction`. Never check balance outside the transaction (TOCTOU).

### API Route Rules
- Every new `route.ts` → update matching `docs/api/*.md` **same commit**
- Always add CORS headers: `Access-Control-Allow-Origin: *`
- Rate-limit via `src/lib/ratelimit.ts`
- Cron endpoints: verify `Authorization: Bearer <CRON_SECRET>`
- Log queries via `logQuery` from `src/lib/query-logger.ts`

### Required Env Vars
```env
DATABASE_URL                   # Postgres (Supabase) — required
DIRECT_URL                     # Supabase direct connection (for migrations)
CRON_SECRET                    # Protects /api/v1/cron/* endpoints
MAIAT_ADMIN_PRIVATE_KEY        # Oracle sync: writes trust scores to MaiatOracle on-chain
BASE_RELAYER_PRIVATE_KEY       # EAS attestation: signs Maiat Receipt attestations on Base
ALCHEMY_BASE_RPC               # Base mainnet RPC
ALCHEMY_API_KEY                # Alchemy API key (token analysis)
NEXT_PUBLIC_PRIVY_APP_ID       # Privy wallet auth (client-side)
PRIVY_APP_ID                   # Privy server-side
PRIVY_APP_SECRET               # Privy server-side secret
UPSTASH_REDIS_REST_URL         # Rate limiter (graceful fallback if missing)
UPSTASH_REDIS_REST_TOKEN       # Rate limiter token
GEMINI_API_KEY                 # AI deep insights + review quality scoring
BASE_BUILDER_CODE              # bc_cozhkj23 — appended to swap calldata
```

> Note: `EAS_TRUST_SCORE_SCHEMA_UID` is hardcoded in `src/lib/eas.ts` — not an env var.

---

## Common Patterns

```ts
// Trust-gate before any action
const { verdict, trustScore } = await maiat.agentTrust(address)
if (verdict === 'avoid') return { blocked: true, trustScore }

// Use tier labels from thresholds
import { TRUST_SCORE } from '@/lib/thresholds'
const label = TRUST_SCORE.label(score)      // "LOW RISK"
const color = TRUST_SCORE.hexColor(score)   // "#10b981"
const risk  = TRUST_SCORE.riskLevel(score)  // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

// SSE live monitor
const es = new EventSource('https://app.maiat.io/api/v1/monitor/feed')
es.onmessage = ({ data }) => console.log(JSON.parse(data))

// Rate limit an endpoint
import { createRateLimiter, checkIpRateLimit } from '@/lib/ratelimit'
const limiter = createRateLimiter('my-endpoint', 20, 86400) // 20 req/day
const { success, remaining } = await checkIpRateLimit(req, limiter)
if (!success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
```

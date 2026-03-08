---
name: maiat-api
description: >
  Build integrations with Maiat Protocol — the trust layer for agentic commerce.
  Use this skill when: writing code that queries Maiat trust scores, integrating
  trust-gated swaps, submitting reviews, staking in markets, or building on top
  of the Maiat API. Covers API usage, SDK, contract addresses, and coding conventions.
---

# Maiat Protocol — Agent Skill

## What is Maiat?

Maiat is a **trust oracle for AI agents and tokens**.  
Scores agents/tokens via on-chain ACP behavioral data + community reviews,  
and exposes that score as a trust gate for swaps, reviews, and prediction markets.

**Live:** `https://app.maiat.io`  
**API base:** `https://app.maiat.io/api/v1`  
**Full docs:** `https://github.com/JhiNResH/maiat-protocol/tree/master/docs/api`

---

## Core Concepts

| Concept | Description |
|---|---|
| **Trust Score** | 0–100. ≥70 = Gold (proceed), 40–69 = Amber (caution), <40 = Red (avoid) |
| **Verdict** | `proceed` / `caution` / `avoid` / `unknown` |
| **Scarab 🪲** | Off-chain reputation points. Earned by reviewing, spent on votes/stakes |
| **EAS Receipt** | On-chain attestation of every trust interaction (Base mainnet) |
| **ACP Behavioral** | Primary data source: Virtuals ACP job completion/payment rates |

---

## SDK Usage (`maiat-sdk`) ← Preferred

```ts
import { Maiat } from 'maiat-sdk'

const maiat = new Maiat({
  baseUrl: 'https://app.maiat.io', // optional, this is the default
  apiKey: process.env.MAIAT_API_KEY,            // optional — raises rate limits
  clientId: 'my-agent-name',                    // optional — for attribution
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

### Agent Trust
```
GET  /api/v1/agent/{address}           → trust score + verdict
GET  /api/v1/agent/{address}/deep      → + percentile, risk flags, tier
GET  /api/v1/agent/token-map/{token}   → token address → agent wallet reverse lookup
GET  /api/v1/agents?sort=trust&limit=50&search=name   → list all indexed agents
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

### Scarab
```
GET  /api/v1/scarab?address=0x...           → { balance, totalEarned, streak }
POST /api/v1/scarab/claim { address }        → { amount, streak, isFirstClaim }
GET  /api/v1/scarab/status?address=0x...    → { canClaim, nextClaimAt }
GET  /api/v1/scarab/nonce?address=0x...     → SIWE nonce for signing
```

### Markets
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

## Coding Conventions (when working in maiat-protocol repo)

### Trust Score Formula
```
Score = (On-Chain Behavioral × 0.5) + (Off-Chain Signals × 0.3) + (Human Reviews × 0.2)
```
Source: `src/lib/scoring-constants.ts`

### Scarab Economy
| Action | Δ |
|---|---|
| First claim | +20 |
| Daily claim | +5 + streak |
| Submit review | −2 |
| Project vote | −5 |
| Market stake | −amount |

> **Critical:** Scarab spend logic must be inside `prisma.$transaction`. Never check balance outside the transaction (TOCTOU).

### API Route Rules
- Every new `route.ts` → update matching `docs/api/*.md` **same commit**
- Always add CORS headers (see existing routes for pattern)
- Rate-limit via `src/lib/ratelimit.ts`
- Cron endpoints: always verify `Authorization: Bearer <CRON_SECRET>`

### Required Env Vars
```env
DATABASE_URL                   # Postgres (Supabase) — required
DIRECT_URL                     # Supabase direct connection (for migrations)
CRON_SECRET                    # Protects /api/v1/cron/* endpoints
MAIAT_ADMIN_PRIVATE_KEY        # Oracle sync: writes trust scores to MaiatOracle on-chain
BASE_RELAYER_PRIVATE_KEY       # EAS attestation: signs Maiat Receipt attestations on Base
ALCHEMY_BASE_RPC               # Base mainnet RPC (e.g. base-mainnet.g.alchemy.com/v2/KEY)
ALCHEMY_API_KEY                # Alchemy API key (used by token analysis)
NEXT_PUBLIC_PRIVY_APP_ID       # Privy wallet auth (client-side)
PRIVY_APP_ID                   # Privy server-side
PRIVY_APP_SECRET               # Privy server-side secret
UPSTASH_REDIS_REST_URL         # Rate limiter (graceful fallback if missing)
UPSTASH_REDIS_REST_TOKEN       # Rate limiter token
GEMINI_API_KEY                 # AI deep insights + review quality scoring
BASE_BUILDER_CODE              # bc_cozhkj23 — appended to swap calldata
```

> Note: `EAS_TRUST_SCORE_SCHEMA_UID` is hardcoded in `src/lib/eas.ts` — not an env var.  
> Note: There is no `UNISWAP_API_KEY` env var — the Uniswap Trading API key lives in `~/maiat-agent/.env`.

---

## Common Patterns

```ts
// Trust-gate before any action
const { verdict, trustScore } = await maiat.agentTrust(address)
if (verdict === 'avoid') return { blocked: true, trustScore }

// SSE live monitor
const es = new EventSource('https://app.maiat.io/api/v1/monitor/feed')
es.onmessage = ({ data }) => console.log(JSON.parse(data))

// Check if wallet can review (must have interacted with contract)
const res = await fetch(`/api/v1/wallet/${address}/check-interaction?contractAddress=${contract}`)
const { interacted } = await res.json()
```

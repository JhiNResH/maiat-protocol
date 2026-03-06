---
name: maiat-protocol
description: >
  Build integrations with Maiat Protocol — the trust layer for agentic commerce.
  Use this skill when: writing code that queries Maiat trust scores, integrating
  trust-gated swaps, submitting reviews, staking in markets, or building on top
  of the Maiat API. Covers API usage, SDK, contract addresses, and coding conventions.
---

# Maiat Protocol — Agent Skill

## What is Maiat?

Maiat is a **trust oracle for AI agents and tokens**.  
It scores agents/tokens based on on-chain ACP behavioral data + community reviews,  
then exposes that score as a trust gate for swaps, reviews, and prediction markets.

**Live:** `https://maiat-protocol.vercel.app`  
**API base:** `https://maiat-protocol.vercel.app/api/v1`  
**Full docs:** `docs/api/README.md`

---

## Core Concepts

| Concept | Description |
|---|---|
| **Trust Score** | 0–100. ≥80 = proceed, 60–79 = caution, <60 = avoid |
| **Verdict** | `proceed` / `caution` / `avoid` / `unknown` |
| **Scarab 🪲** | Off-chain reputation points. Earned by reviewing, spent on votes/stakes |
| **EAS Receipt** | On-chain attestation of every trust interaction (Base mainnet) |
| **ACP Behavioral** | Primary data source: Virtuals ACP job completion/payment rates |

---

## Key API Endpoints

### Trust Score
```ts
// Agent trust score
GET /api/v1/agent/0xAbCd...

// Deep analysis (percentile, risk flags, tier)
GET /api/v1/agent/0xAbCd.../deep

// Token → agent reverse lookup
GET /api/v1/agent/token-map/0xTokenAddress
```

### Trust-Gated Swap
```ts
// 1. Get quote (checks trust score)
GET /api/v1/swap/quote?tokenIn=0x0000...&tokenOut=0x4ed4...&amount=1000000000000000000&swapper=0xYours

// 2. Execute if allowed
POST /api/v1/swap
Body: { quoteId, tokenIn, tokenOut, amountIn, swapper, chainId: 8453 }
```

### Scarab
```ts
GET  /api/v1/scarab?address=0x...           // balance
POST /api/v1/scarab/claim { address }        // daily claim
GET  /api/v1/scarab/status?address=0x...    // eligibility
```

### Markets
```ts
GET  /api/v1/markets                          // list open markets
POST /api/v1/markets/{id}/position { address, projectId, amount }  // stake
```

---

## SDK Usage (`maiat-sdk`)

```ts
import { MaiatClient } from 'maiat-sdk'

const client = new MaiatClient({
  baseUrl: 'https://maiat-protocol.vercel.app/api/v1',
  apiKey: process.env.MAIAT_API_KEY,  // optional — raises rate limits
})

// Check trust before transacting
const score = await client.agent.getScore('0xAbCd...')
if (score.verdict === 'avoid') throw new Error('Agent not trusted')

// Trust-gated swap
const quote = await client.swap.quote({ tokenIn, tokenOut, amount, swapper })
if (quote.allowed) {
  const tx = await client.swap.execute(quote)
  console.log(tx.explorer)
}
```

**SDK location:** `packages/sdk/`

---

## Smart Contracts (Base Mainnet)

| Contract | Address |
|---|---|
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` |
| MaiatReceiptResolver | `0xda696009655825124bcbfdd5755c0657d6d841c0` |
| TrustGateHook (Uniswap v4) | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` |
| EAS Schema UID | `0x24b0db687434f15057bef6011b95f1324f2c38af06d0e636aea1c58bf346d802` |

---

## Coding Conventions

### File Structure
```
src/
  app/api/v1/          ← All public API routes
  lib/                 ← Shared logic (scoring.ts, eas.ts, uniswap.ts, scarab.ts)
  components/          ← React UI
packages/sdk/          ← maiat-sdk npm package
contracts/             ← Solidity (Foundry)
docs/api/              ← API reference (keep in sync with routes)
```

### API Route Rules
- Every `route.ts` → update matching `docs/api/*.md` in the **same commit**
- Always add CORS headers (see existing routes for pattern)
- Rate-limit sensitive endpoints via `src/lib/ratelimit.ts`
- Cron endpoints: **always** verify `Authorization: Bearer <CRON_SECRET>`

### Trust Score Calculation
```
Score = (ACP Behavioral × 0.7) + (Community Reviews × 0.3)
```
Source: `src/lib/scoring.ts`

### Scarab Economy
| Action | Delta |
|---|---|
| First claim | +20 |
| Daily claim | +5 + streak |
| Submit review | −2 |
| Project vote | −5 |
| Market stake | −amount |

Spend logic is atomic inside `prisma.$transaction` — do **not** check balance outside the transaction.

### Environment Variables (required for full functionality)
```env
DATABASE_URL                   # Postgres (Supabase)
CRON_SECRET                    # Protects /cron/* endpoints
MAIAT_ADMIN_PRIVATE_KEY        # EAS attestation + oracle sync relayer
EAS_TRUST_SCORE_SCHEMA_UID     # From /eas/register (one-time setup)
UNISWAP_API_KEY                # Uniswap Trading API
NEXT_PUBLIC_PRIVY_APP_ID       # Privy auth
```

---

## Common Patterns

### Trust-gate any action
```ts
const { verdict, trustScore } = await fetch(`/api/v1/agent/${address}`).then(r => r.json())
if (verdict === 'avoid') return { error: 'Agent trust score too low', trustScore }
```

### Check if wallet can review a project
```ts
GET /api/v1/wallet/{address}/check-interaction?contractAddress={projectContract}
// interacted: true → can review
```

### Subscribe to live events (SSE)
```ts
const es = new EventSource('/api/v1/monitor/feed')
es.onmessage = ({ data }) => console.log(JSON.parse(data))
```

---
name: maiat-api
description: >
  Trust layer for AI agents. Use this skill when: checking if an agent is trustworthy
  before hiring, verifying a token before swapping, or protecting your wallet from
  scams. Covers trust scoring, token safety, and wallet protection.
license: MIT
metadata:
  author: JhiNResH
  version: "2.3.0"
  privacy: >
    MCP mode sends query context to app.maiat.io. Do not use MCP if your
    conversation contains sensitive data. REST API mode only sends explicit
    request payloads.
---

# Maiat Protocol — Agent Skill

## What is Maiat?

Maiat is the **trust layer for agentic commerce** — answering one question: **"Is this agent trustworthy?"**

Powered by **Wadjet**, an ML risk engine that combines on-chain behavioral data, token health signals, and community reviews into a single trust score.

**API base:** `https://app.maiat.io/api/v1`
**Coverage:** 18,600+ indexed agents from Virtuals ACP

---

## Quick Start — Which endpoint do I call?

```
You have an address. What is it?

  Agent wallet (0x...)     → GET /api/v1/agent/{address}      ($0.02)
  Token contract (0x...)   → GET /api/v1/token/{address}      ($0.01)
  Want to swap a token     → POST /api/v1/trust-swap          ($0.05)
  Need deep forensics      → POST /api/v1/token-forensics     ($0.05)
  Want social proof        → GET /api/v1/review?address=0x... ($0.03)
  Not sure                 → GET /api/v1/agent/{address}      (default)
```

### Minimum viable integration (2 lines):
```ts
const res = await fetch(`https://app.maiat.io/api/v1/agent/${address}`)
const { trustScore, verdict } = await res.json()
// verdict: "trusted" | "proceed" | "caution" | "avoid"
// If verdict === "avoid", do not proceed.
```

---

## Connection — Pick one

| Method | Best for | Setup |
|---|---|---|
| **REST API** | Any agent, any language | `fetch()` to `app.maiat.io/api/v1` — no auth required |
| **MCP** | LLM agents (Claude, GPT) | Add `https://app.maiat.io/api/mcp` as MCP server |
| **SDK** | TypeScript agents | `npm i @jhinresh/maiat-sdk` |
| **Guard** | Agents with wallets | `npm i @maiat/viem-guard` — wraps every tx with trust check |

**No API key needed.** All endpoints are open. Optional `X-Maiat-Client: your-agent-name` header for identity tracking.

### Rate Limits
- **Default:** 20 requests/minute per IP
- **With `X-Maiat-Client` header:** 60 requests/minute
- **Burst:** Up to 5 concurrent requests allowed
- **On 429:** Wait 60 seconds and retry. Do not hammer.

---

## ACP Offerings (5 total)

| Offering | Price | TTL | What it does |
|---|---|---|---|
| `agent_trust` | $0.02 USDC | 5min | Before paying another agent, call this to verify their reliability. Returns: trustScore 0-100, verdict (proceed/caution/avoid), completionRate, paymentRate, expireRate, totalJobs — sourced from on-chain Virtuals ACP job history, covers all 18,600+ registered agents. Use when: you are about to hire an unknown agent for any job. If verdict is 'avoid', do not proceed. For checking a token address before swapping, use token_check instead. |
| `token_check` | $0.01 USDC | 5min | Before swapping into an unknown ERC-20 token on Base, call this to verify it is safe. Returns: trustScore 0-100, verdict (proceed/caution/avoid), riskFlags (honeypot/highTax/unverified), riskSummary. Use when: you have a token address and want to know if it is safe to buy. For hiring agents instead of checking tokens, use agent_trust. For a bundled check+swap in one call, use trust_swap. |
| `token_forensics` | $0.05 USDC | 5min | Deep rug pull risk analysis for any ERC-20 token on Base. Powered by Wadjet ML engine (XGBoost trained on 9,500+ agents) blended with on-chain heuristics: contract ownership & proxy patterns, holder concentration & whale distribution, liquidity depth & lock status, and trading pattern flags. Returns: rugScore 0-100 (blended 60% ML + 40% heuristic), riskLevel (low/medium/high/critical), detailed contract/holder/liquidity breakdown, Wadjet ML confidence score, and individual scoring components. |
| `trust_swap` | $0.05 USDC | 5min | Trust-gated token swap: bundles token_check + Uniswap quote in one call. Before returning calldata, verifies the output token for honeypot risk, tax, and contract safety. Returns: trustScore, verdict, riskFlags, riskSummary, Uniswap quote (amountOut, priceImpact, route), unsigned calldata. You sign and submit — Maiat never holds funds. If verdict is 'avoid', calldata is withheld. For check-only without swapping, use token_check. |
| `agent_reputation` | $0.03 USDC | — | What the community says about this agent. Returns verified reviews, sentiment analysis, quality-scored opinions, upvote/downvote ratios, market consensus, and community verdict. This is social proof data that only Maiat has — powered by interaction-verified reviews and trust-weighted opinion markets. Pair with agent_trust for the complete picture. |

---

## Error Handling

```
HTTP 200  → success, read verdict field
HTTP 404  → agent/token not found in our index. Treat as unknown — proceed with caution
HTTP 429  → rate limited. Wait 60s, then retry once. Do not loop.
HTTP 500  → Maiat is down. Fallback: proceed with caution, do not block the user
Timeout   → 10s max. If no response in 10s, treat as unknown.

Rule: Never block a transaction just because Maiat is unreachable.
      Default to "caution" if you can't reach us.
```

---

## Outcome Reporting (Important)

After acting on a trust score, **always report the outcome**. This is how Wadjet learns.

```
POST /api/v1/outcome
Body: {
  "jobId": "<queryId>",         ← from the "feedback.queryId" field in any API response
  "outcome": "success|failure|partial|expired",
  "reporter": "0xYourWallet"
}
```

Every API response includes `feedback.queryId` — save it, use it when reporting.

Reporting earns **+5 🪲 Scarab** reputation points.

---

## Score Tiers

| Score | Verdict | What to do |
|---|---|---|
| ≥ 80 | `trusted` | ✅ Safe to proceed |
| 60–79 | `proceed` | ✅ Proceed with standard checks |
| 40–59 | `caution` | ⚠️ Extra verification recommended |
| < 40 | `avoid` | 🚫 Do not proceed |

### Response Format
```json
{
  "trustScore": 73,
  "verdict": "proceed",
  "breakdown": {
    "completionRate": 0.92,
    "paymentRate": 0.88,
    "totalJobs": 47,
    "uniqueBuyerCount": 12
  },
  "feedback": {
    "queryId": "q_abc123"
  }
}
```

---

## Protect Your Wallet (Maiat Guard)

If your agent sends transactions, **wrap it with Maiat Guard** to auto-protect every tx.

```bash
npm install @maiat/viem-guard viem
```

```ts
import { createMaiatAgentWallet } from '@maiat/viem-guard'

const wallet = createMaiatAgentWallet(yourProvider, {
  minScore: 60,        // block txs to addresses with score < 60
  antiPoison: true,    // detect address poisoning attacks
})

// Every sendTransaction is now trust-gated
await wallet.sendTransaction({ to, value })
```

### What Guard Does
1. **Anti-Poisoning** — detects vanity match attacks and dust liveness traps
2. **Trust Check** — queries Maiat before every tx. Low trust → blocks
3. **TrustGateHook** — auto-injects hookData for best fee tier on Uniswap v4 pools
4. **Collective Immunity** — blocked threats are reported network-wide. All Guard users get instant protection
5. **Outcome Recording** — every tx result feeds back to Wadjet ML

**Package:** `@maiat/viem-guard` (v0.2.0) — [GitHub](https://github.com/JhiNResH/maiat-guard)

---

## Architecture

```
Your Agent
    ↓
Maiat Protocol (API Gateway — Vercel)
    ↓
Wadjet (ML Engine — Railway)
├── ACP behavioral data (18,600+ agents)
├── Token health (DexScreener, XGBoost on 32,900+ samples)
├── Community reviews + sentiment
└── Watchlist monitoring + threat scanning
    ↓
One answer: trustScore 0-100 + verdict
```

---

## All API Endpoints

### Agent Trust
```
GET  /api/v1/agent/{address}            → trust score + verdict + breakdown
GET  /api/v1/agent/{address}/deep       → + percentile, risk flags, tier
GET  /api/v1/agents?sort=trust&limit=50 → list indexed agents
```

### Token Safety
```
GET  /api/v1/token/{address}            → honeypot, tax, liquidity, verdict
```

### Reviews & Reputation
```
GET  /api/v1/review?address=0x...       → community reviews + sentiment
POST /api/v1/review                     → submit review
POST /api/v1/review/vote                → upvote/downvote
```

### Scarab 🪲 (Reputation Points)
```
GET  /api/v1/scarab?address=0x...       → balance, totalEarned, streak
POST /api/v1/scarab/claim { address }   → daily claim
```

### Outcome
```
POST /api/v1/outcome                    → report job outcome (earns 5 Scarab)
```

### Threat Reporting
```
POST /api/v1/threat/report
Body: { "maliciousAddress": "0x...", "threatType": "address_poisoning|low_trust|vanity_match", "chainId": 8453 }
```

3+ independent reports → address auto-flagged to trustScore 0 network-wide.

---

## MCP Tools

Endpoint: `https://app.maiat.io/api/mcp`

| Tool | Description |
|---|---|
| `get_agent_trust` | Trust score + verdict |
| `get_agent_reputation` | Community reviews + sentiment |
| `report_outcome` | Report job result (earns 5 🪲 Scarab) |
| `get_scarab_balance` | Check reputation points |
| `submit_review` | Submit a review |
| `vote_review` | Upvote/downvote a review |

---

## On-Chain Contracts (Base)

| Contract | Address | Network |
|---|---|---|
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` | Mainnet |
| TrustGateHook (Uniswap v4) | `0xf6065fb076090af33ee0402f7e902b2583e7721e` | Sepolia |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Mainnet |
| ERC-8004 Reputation Registry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Mainnet |

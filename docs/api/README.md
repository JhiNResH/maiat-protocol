# Maiat Protocol API Reference

**Base URL:** `https://app.maiat.io/api/v1`  
**Format:** JSON over HTTPS  
**Auth:** Most endpoints are public. Cron endpoints require `Authorization: Bearer <CRON_SECRET>`.

---

## Endpoints Overview

| Category | Method | Path | Status | Description |
|---|---|---|---|---|
| **Unified** | GET | `/trust` | ✅ Live | Simplified trust score — works for agents AND tokens |
| **Agents** | GET | `/agent/{address}` | ✅ Live | ACP behavioral trust score + verdict |
| | GET | `/agent/{address}/deep` | ✅ Live | + percentile, risk flags, tier, recommendation |
| | GET | `/agent/token-map/{token}` | ✅ Live | Token address → agent wallet reverse lookup |
| | GET | `/agents` | ✅ Live | List all indexed agents (sort, limit, search) |
| **Tokens** | GET | `/token/{address}` | ✅ Live | Honeypot check, liquidity, trust verdict |
| | GET | `/token/{address}/forensics` | ✅ Live | Deep rug pull risk analysis |
| **Swap** | POST | `/swap/quote` | ✅ Live | Trust-gated Uniswap quote (+ Base Builder attribution) |
| | POST | `/swap` | ✅ Live | Execute trust-gated swap (requires signed quote) |
| **Markets** | GET | `/markets` | ✅ Live | List prediction markets |
| | GET | `/markets/{id}` | ✅ Live | Market detail + positions |
| | POST | `/markets/{id}/position` | ✅ Live | Stake Scarab on outcome |
| **Scarab** | GET | `/scarab` | ✅ Live | Balance, totalEarned, streak |
| | GET | `/scarab/status` | ✅ Live | Claim eligibility |
| | POST | `/scarab/claim` | ✅ Live | Daily claim |
| **Reviews** | GET | `/review` | ✅ Live | Community reviews for an address |
| | POST | `/review` | ✅ Live | Submit a review |
| | POST | `/review/vote` | ✅ Live | Upvote / downvote a review |
| **Wallet** | GET | `/wallet/{address}/passport` | ✅ Live | Trust tier, Scarab, reviews |
| | GET | `/wallet/{address}/interactions` | ✅ Live | On-chain interaction history (Alchemy) |
| | GET | `/wallet/{address}/eas-receipts` | ✅ Live | EAS attestation receipts |
| **Outcome** | POST | `/outcome` | ✅ Live | Report job outcome (improves oracle + earns 5 🪲) |
| **Evidence** | GET | `/evidence/{address}` | ✅ Live | Cryptographic audit chain (tamper-proof) |
| **Explore** | GET | `/explore` | ✅ Live | Browse agents + tokens |
| **Monitor** | GET | `/monitor/feed` | ✅ Live | SSE real-time event stream |
| | GET | `/monitor/sweeps` | ✅ Live | Recent audit sweeps |
| **Stats** | GET | `/stats` | ✅ Live | Platform statistics |
| **AI** | POST | `/deep-insight` | ✅ Live | AI-powered deep entity analysis |
| **Cron** *(internal)* | GET | `/cron/index-agents` | 🔒 Internal | Daily ACP indexer |
| | GET | `/cron/auto-attest` | 🔒 Internal | Daily EAS attestation |
| | GET | `/cron/oracle-sync` | 🔒 Internal | On-chain oracle sync |

---

## Verdict Thresholds

All trust endpoints return a `verdict` field:

| Verdict | Score Range | Meaning |
|---|---|---|
| `proceed` | ≥ 80 | Safe to transact |
| `caution` | 60–79 | Proceed with care |
| `avoid` | < 60 | High risk |
| `unknown` | — | Not indexed yet |

Source: `src/app/api/v1/agent/[address]/route.ts` → `scoreToVerdict()`

---

## Authentication

```
X-Maiat-Client: my-agent-name    # Recommended — auto-creates wallet + 10 Scarab on first call
X-Maiat-Key: mk_xxxx             # Optional — raises rate limit to 100 req/day
```

No signature required. `X-Maiat-Client` is your stable identity across all calls.

---

## Rate Limits

| Endpoint | Default | With API Key |
|---|---|---|
| `/trust` | 20 req/day per IP | 100 req/day |
| `/swap/quote` | 15 req/min | 15 req/min |
| `/swap` | 10 req/min | 10 req/min |
| `/deep-insight` | 10 req/day | 10 req/day |
| All others | 60 req/min | 60 req/min |

---

## Common Error Responses

```json
{ "error": "Invalid address", "message": "Please provide a valid EVM address (0x...)" }
{ "error": "Rate limit exceeded. Max 20 requests/day per IP." }
{ "error": "Internal server error" }
```

---

## Feedback Loop (Important!)

Every API response includes a `feedback` block:
```json
{
  "feedback": {
    "queryId": "cmmk2x7jd...",
    "reportOutcome": "POST /api/v1/outcome { \"jobId\": \"cmmk2x...\", \"outcome\": \"success|failure|partial|expired\", \"reporter\": \"0x...\" }",
    "note": "Report outcome to improve oracle accuracy."
  }
}
```

Always report outcomes after acting on a trust score — earns +5 🪲 Scarab and improves the oracle.

---

→ See individual files for detailed endpoint docs:
- [agents.md](./agents.md) — agent trust, deep check, token-map, list
- [markets.md](./markets.md) — prediction markets, positions
- [scarab.md](./scarab.md) — Scarab economy, balance, claim
- [swap.md](./swap.md) — trust-gated Uniswap swaps
- [eas.md](./eas.md) — EAS attestations, evidence chain
- [wallet.md](./wallet.md) — passport, interactions, receipts
- [explore.md](./explore.md) — browse, stats
- [monitor.md](./monitor.md) — SSE feed, sweeps
- [cron.md](./cron.md) — internal cron jobs

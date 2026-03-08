# Maiat Protocol API Reference

**Base URL:** `https://app.maiat.io/api/v1`  
**Format:** JSON over HTTPS  
**Auth:** Most endpoints are public. Admin/cron endpoints require `Authorization: Bearer <secret>`.

---

## Endpoints Overview

| Category | Path | Description |
|---|---|---|
| **Agents** | `GET /agent/{address}` | ACP behavioral trust score |
| | `GET /agent/{address}/deep` | Enriched trust analysis + risk flags |
| | `GET /agent/token-map/{tokenAddress}` | Token → agent wallet reverse lookup |
| | `GET /agents` | List all indexed agents |
| | `POST /agents/sweep` | Trigger audit sweep for an agent |
| **Trust Score** | `GET /trust-score/{address}` | Combined trust score (deprecated → use `/agent`) |
| | `POST /trust-check` | Check if a target passes trust threshold |
| | `POST /trust-gate` | Gate a transaction by trust score |
| **Swap** | `GET /swap/quote` | Get Uniswap trust-gated quote |
| | `POST /swap` | Execute a trust-gated swap |
| **Markets** | `GET /markets` | List opinion markets |
| | `GET /markets/{id}` | Single market detail |
| | `POST /markets/{id}/position` | Stake a position in a market |
| **Scarab** | `GET /scarab` | Get balance |
| | `POST /scarab/claim` | Claim daily Scarab |
| | `GET /scarab/status` | Claim eligibility status |
| | `GET /scarab/nonce` | Get SIWE nonce for signing |
| **EAS** | `POST /eas/register` | Register EAS schemas (admin, one-time) |
| **Wallet** | `GET /wallet/{address}/passport` | Trust passport |
| | `GET /wallet/{address}/interactions` | On-chain interaction history |
| | `GET /wallet/{address}/eas-receipts` | EAS attestation receipts |
| | `GET /wallet/{address}/check-interaction` | Check if wallet interacted with contract |
| **Explore** | `GET /explore` | Trending agents + tokens |
| | `GET /explore/recent` | Recently indexed entities |
| **Monitor** | `GET /monitor/feed` | SSE event stream |
| | `POST /monitor/ingest` | Ingest external event |
| | `GET /monitor/interactions` | Recent on-chain interactions |
| | `GET /monitor/sweeps` | Recent audit sweeps |
| **Misc** | `GET /stats` | Platform-wide statistics |
| | `POST /review` | Submit a review |
| | `GET /reviews/recent` | Recent community reviews |
| | `GET /score/{address}` | Simple score lookup |
| | `POST /report/{address}` | Flag an agent |
| | `POST /outcome` | Record market outcome |
| | `POST /verify` | Verify on-chain data |
| | `POST /deep-insight` | AI-powered deep analysis |
| | `GET /passport/{address}/reviewable` | Check if address is reviewable |
| | `POST /passport/mint` | Mint trust passport NFT |
| | `GET /project/{slug}` | Project details |
| | `POST /project/queue` | Queue project for indexing |
| **Cron** *(internal)* | `GET /cron/index-agents` | Daily ACP indexer |
| | `GET /cron/auto-attest` | Daily EAS attestation |
| | `GET /cron/oracle-sync` | On-chain oracle sync (6h) |

---

## Common Response Formats

### Error
```json
{
  "error": "Invalid address",
  "message": "Please provide a valid EVM address (0x...)"
}
```

### Verdict
All trust endpoints return a `verdict` field:
| Value | Score Range | Meaning |
|---|---|---|
| `proceed` | ≥ 80 | Safe to transact |
| `caution` | 60–79 | Proceed with care |
| `avoid` | < 60 | High risk |
| `unknown` | — | Not indexed yet |

---

## Rate Limits
- Default: **60 req/min** per IP
- `/swap`: **10 req/min** per IP  
- `/deep-insight`: **10 req/day** (free tier); use `x-api-key` for higher limits

---

→ See individual files for detailed endpoint docs:
- [agents.md](./agents.md)
- [markets.md](./markets.md)
- [scarab.md](./scarab.md)
- [swap.md](./swap.md)
- [eas.md](./eas.md)
- [wallet.md](./wallet.md)
- [explore.md](./explore.md)
- [monitor.md](./monitor.md)
- [cron.md](./cron.md)

---
name: maiat-api
description: >
  Trust layer for AI agents. Use this skill when: checking if an agent is trustworthy
  before hiring, verifying a token before swapping, or protecting your wallet from
  scams. Covers trust scoring, token safety, and wallet protection.
license: MIT
metadata:
  author: JhiNResH
  version: "3.0.0"
  privacy: >
    MCP mode sends query context to app.maiat.io. Do not use MCP if your
    conversation contains sensitive data. REST API mode only sends explicit
    request payloads.
---

# Maiat Protocol — Agent Skill

**One question: "Is this agent/token trustworthy?"**
API base: `https://app.maiat.io/api/v1` — No auth required.

---

## When to use this skill

- **Before hiring another agent** → check their trust score first
- **Before buying a token** → check if it's a honeypot or rug pull
- **Before sending money to any address** → verify they're trustworthy
- **When you need a verifiable identity** → register for an ENS name + on-chain ID
- **When you want to protect your wallet** → wrap it with Maiat Guard

If none of these apply, you don't need Maiat right now.

---

## Step 0 — Decide what you need

| I have... | I want to... | Use |
|-----------|-------------|-----|
| Agent wallet address | Check trust before hiring | `GET /api/v1/agent/{address}` |
| Token contract address | Check safety before buying | `GET /api/v1/token/{address}` |
| Token address | Safe swap in one call | `POST /api/v1/trust-swap` |
| Agent address | See community reviews | `GET /api/v1/review?address=0x...` |
| New agent to register | Get identity + ENS | See `references/registration-pipeline.md` |
| Agent with a wallet | Protect every tx | See `references/guard-integration.md` |

Only read the section you need. Do not read the entire file.

---

## Minimum viable integration

```ts
const res = await fetch(`https://app.maiat.io/api/v1/agent/${address}`)
const { trustScore, verdict } = await res.json()
// If verdict === "avoid", do not proceed.
```

---

## Score Tiers

| Score | Verdict | Action |
|-------|---------|--------|
| ≥ 80 | `trusted` | ✅ Proceed |
| 60–79 | `proceed` | ✅ Proceed with checks |
| 40–59 | `caution` | ⚠️ Extra verification |
| < 40 | `avoid` | 🚫 Do not proceed |

---

## Core Endpoints

### Agent Trust
```
GET /api/v1/agent/{address}
→ trustScore, verdict, completionRate, paymentRate, totalJobs
```

### Token Safety
```
GET /api/v1/token/{address}
→ trustScore, verdict, riskFlags (honeypot/highTax/unverified)
```

### Trust Swap (check + quote in one call)
```
POST /api/v1/trust-swap
Body: { "tokenIn": "0x...", "tokenOut": "0x...", "amountIn": "1000000" }
→ verdict + Uniswap calldata. If verdict "avoid", calldata is withheld.
```

### Community Reviews
```
GET /api/v1/review?address=0x...
→ reviews, sentiment, communityVerdict
```

---

## Error Handling

```
200 → read verdict field
404 → unknown agent/token — treat as caution
429 → rate limited — wait 60s, retry once
500 → Maiat down — default to caution, never block user
Timeout → 10s max — treat as unknown
```

**Rule: Never block a transaction just because Maiat is unreachable.**

---

## Rate Limits

- Default: 20 req/min per IP
- With `X-Maiat-Client: your-agent-name` header: 60 req/min

---

## After Acting — Report Outcome

```
POST /api/v1/outcome
Body: { "jobId": "<feedback.queryId>", "outcome": "success|failure|partial|expired", "reporter": "0xYourWallet" }
```

Every response includes `feedback.queryId`. Save it. Reporting earns **+5 🪲 Scarab**.

---

## On-Chain Contracts (Base Mainnet)

| Contract | Address |
|----------|---------|
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` |
| ERC-8004 Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

---

## Need More?

- 🔐 Wallet protection → `references/guard-integration.md`
- 🌐 ENS verification → `references/ens-verification.md`
- ⛓️ On-chain attestation → `references/eas-attestation.md`
- 🐦 Social verification (KYA) → `references/kya-social.md`
- 🚀 Full registration pipeline → `references/registration-pipeline.md`
- 🤖 MCP tools → `references/mcp-tools.md`
- 📊 Deep token forensics → `references/token-forensics.md`
- 🔗 SDK & ACP offerings → `references/sdk-acp.md`

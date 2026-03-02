# Maiat Protocol

**The trust layer for the onchain economy.**

Maiat scores AI agents and tokens on trustworthiness using on-chain job history, honeypot detection, and community reviews. ERC-8004 compliant. Powers safe agent-to-agent commerce on ACP.

> Like Chainlink is a price oracle, Maiat is a trust oracle.

Live: [maiat-protocol.vercel.app](https://maiat-protocol.vercel.app) · Agent ID: [3723 on Virtuals ACP](https://app.virtuals.io/acp)

---

## What It Does

| Use Case | Endpoint | Fee |
|---|---|---|
| Check if a token is a honeypot | `GET /api/v1/token/:address` | Free |
| Get trust score for an ACP agent | `GET /api/v1/agent/:address` | Free |
| Trust-verified token swap | `POST /api/v1/swap/quote` | Free |
| Browse all indexed agents | `GET /api/v1/agents` | Free |

---

## API Reference

### Token Safety Check

```bash
GET /api/v1/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

```json
{
  "address": "0x833589...",
  "symbol": "USDC",
  "verdict": "proceed",
  "trustScore": 100,
  "riskFlags": [],
  "dataSource": "KNOWN_SAFE"
}
```

**Verdicts:** `proceed` (≥70) · `caution` (40–69) · `avoid` (<40)

**Risk flags:** `HONEYPOT` · `HIGH_BUY_TAX` · `HIGH_SELL_TAX` · `UNVERIFIED_CONTRACT` · `INSUFFICIENT_DATA`

---

### ACP Agent Trust Score

```bash
GET /api/v1/agent/0x57795bef2feC610CAa1330A99237fD9dDB3790BE
```

```json
{
  "address": "0x57795b...",
  "trustScore": 95,
  "dataSource": "ACP_BEHAVIORAL",
  "breakdown": {
    "completionRate": 0.8889,
    "paymentRate": 0.9333,
    "expireRate": 0.0611,
    "totalJobs": 1176
  },
  "verdict": "proceed"
}
```

**Verdicts:** `proceed` (≥80) · `caution` (60–79) · `avoid` (<60) · `unknown` (not on ACP)

**Data source:** On-chain Virtuals ACP job history. 449+ agents pre-indexed; all other registered agents fetched on-demand and cached.

**Trust Score Formula:**
```
score = completionRate × 40 + volumeFactor × 25 + diversityFactor × 20 + paymentRate × 15
```

---

### List All Indexed Agents

```bash
GET /api/v1/agents?limit=20&offset=0
```

Returns all agents sorted by trust score descending.

---

## Virtuals ACP Offerings

Maiat is a seller on [Virtuals ACP](https://app.virtuals.io/acp) (agent ID: 3723, wallet: `0xAf1aE6F344c60c7Fe56CB53d1809f2c0B997a2b9`).

| Offering | Fee | What you get |
|---|---|---|
| `token_check` | $0.01 USDC | Honeypot detection, tax check, verdict |
| `agent_trust` | $0.02 USDC | ACP behavioral score, completionRate, totalJobs |
| `trust_swap` | $0.05 + 0.15% | Trust-checked Uniswap swap quote |

---

## Contracts (Base Sepolia)

| Contract | Address |
|---|---|
| TrustScoreOracle | `0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139` |
| TrustGateHook | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` |

> ERC-8004 Agent Reputation Registry — agentId 20854 on [8004scan.io](https://8004scan.io)

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | PostgreSQL + Prisma (Supabase) |
| AI | Google Gemini (deep insight reports) |
| Chain | Base (primary) |
| Deployment | Vercel |
| ACP | Virtuals Protocol ACP node SDK |

---

## Local Development

```bash
git clone https://github.com/JhiNResH/maiat-protocol.git
cd maiat-protocol
npm install

cp .env.example .env
# Fill in: DATABASE_URL, GEMINI_API_KEY

npx prisma generate
npx prisma db push

npm run dev
# → http://localhost:3000
```

### Run the ACP Indexer

```bash
# Index all ACP agents (runs daily via Vercel Cron)
npx tsx scripts/acp-indexer.ts
```

---

## Roadmap

- [x] Token honeypot + tax detection API
- [x] ACP behavioral trust score (449+ agents indexed, on-demand for all others)
- [x] Virtuals ACP offerings live (`token_check`, `agent_trust`, `trust_swap`)
- [x] ERC-8004 compliant (agentId 20854)
- [x] On-demand agent lookup + auto-cache
- [ ] ACP Indexer v2 — on-chain `JobCreated` events for full coverage
- [ ] Scarab community reviews v2
- [ ] Multi-chain (BNB Chain)
- [ ] Maiat token launch (Virtuals ACF)

---

## License

MIT

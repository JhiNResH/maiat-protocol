<p align="center">
  <img src="https://raw.githubusercontent.com/JhiNResH/maiat-protocol/master/public/maiat-logo.jpg" width="120" alt="Maiat" />
</p>

<h1 align="center">Maiat Protocol</h1>

<p align="center">
  <strong>The trust layer for agentic commerce.</strong><br/>
  Trust oracle for AI agents and tokens — powered by on-chain behavioral data, community reviews, and EAS attestations.
</p>

<p align="center">
  <a href="https://app.maiat.io">Live App</a> ·
  <a href="https://app.maiat.io/docs">API Docs</a> ·
  <a href="https://app.virtuals.io/acp">ACP Agent #18281</a>
</p>

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          maiat-protocol                             │
├──────────┬──────────┬──────────┬─────────────────────────────────────┤
│ Web App  │ API      │Contracts │ Packages                            │
│ Next.js  │ /api/v1  │ Solidity │ sdk · guard · mcp · elizaos ·       │
│          │          │          │ agentkit · game · virtuals           │
├──────────┴──────────┴──────────┴─────────────────────────────────────┤
│                          Feedback Loop                               │
│    ACP Query → QueryLog → AgentScore → Oracle Sync → EAS             │
└──────────────────────────────────────────────────────────────────────┘
```

## Connect in 30 Seconds

**MCP (Claude Desktop, Cursor, any MCP-compatible agent):**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "maiat": {
      "url": "https://app.maiat.io/api/mcp"
    }
  }
}
```

5 tools instantly available: `get_agent_trust` · `get_token_forensics` · `get_agent_reputation` · `report_outcome` · `get_scarab_balance`

**REST API (any agent, any LLM):**

```bash
# Agent trust score
curl https://app.maiat.io/api/v1/agent/0x5facebd66d78a69b400dc702049374b95745fbc5

# Token rug risk
curl https://app.maiat.io/api/v1/token/0xYourToken/forensics

# skill.md (for LLM agents)
Read https://app.maiat.io/skill.md and follow the instructions
```

---

## What It Does

| Use Case               | Endpoint                               | Fee      |
| ---------------------- | -------------------------------------- | -------- |
| Token honeypot check   | `GET /api/v1/token/:address`           | Free     |
| Agent trust score      | `GET /api/v1/agent/:address`           | Free     |
| Deep agent analysis    | `GET /api/v1/agent/:address/deep`      | Free     |
| Trust-gated swap quote | `POST /api/v1/swap/quote`              | Free     |
| Browse 2,292+ agents   | `GET /api/v1/agents`                   | Free     |
| Submit review          | `POST /api/v1/review`                  | 2 Scarab |
| Trust Passport         | `GET /api/v1/wallet/:address/passport` | Free     |

---

## Web App Pages

Live at [app.maiat.io](https://app.maiat.io)

| Route                    | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `/monitor`               | Tactical dashboard — real-time agent activity feed, ACP job stream, oracle sync status       |
| `/explore`               | Browse 2,292+ indexed agents with trust scores, colored risk indicators (green/amber/red)    |
| `/leaderboard`           | Top agents ranked by trust score, completion rate, and job volume                            |
| `/agent/[name]`          | Agent detail — behavioral insights, score breakdown, review history, deep analysis           |
| `/passport/[address]`    | Trust Passport — wallet's cross-agent reputation, EAS receipt history _(Phase 2)_            |
| `/review/[address]`      | Submit on-chain review — weighted by tx history (3x) and EAS receipts (5x), burns Scarab    |
| `/swap`                  | Trust-gated swap UI — checks oracle before surfacing Uniswap quote; blocks unsafe tokens     |
| `/markets`               | Prediction markets for AI agent performance outcomes                                         |
| `/dashboard`             | Personal dashboard — your agents, reviews submitted, trust score history                     |
| `/docs`                  | API reference, SDK guides, contract ABIs, integration examples                               |

---

## ACP Offerings (Virtuals Protocol)

Wallet: `0xE6ac05D2b50cd525F793024D75BB6f519a52Af5D`

| Offering            | Fee   | Description                                                                  |
| ------------------- | ----- | ---------------------------------------------------------------------------- |
| `token_check`       | $0.01 | Honeypot detection, tax analysis, risk flags                                 |
| `agent_trust`       | $0.02 | Behavioral trust score + deep analysis (percentile, risk flags, tier)        |
| `token_forensics`   | $0.03 | Deep rug pull risk analysis (contract, holders, liquidity, rug score)        |
| `agent_reputation`  | $0.03 | Community reviews, sentiment, and market consensus for any agent             |

> Each offering response includes `_feedback` with outcome reporting instructions + cross-sell hints. Report outcomes to earn 5 🪲 Scarab and improve oracle accuracy.

---

## Smart Contracts (Base Mainnet)

| Contract                 | Network        | Address                                      | Purpose                                                     |
| ------------------------ | -------------- | -------------------------------------------- | ----------------------------------------------------------- |
| **MaiatOracle**          | Base Mainnet   | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` | On-chain trust scores for AI agents — written by ACP agent after each job |
| **MaiatReceiptResolver** | Base Mainnet   | `0xda696009655825124bcbfdd5755c0657d6d841c0` | EAS Resolver — rejects any attestation not from Maiat Attester |
| **TrustGateHook**        | Base Mainnet   | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` | Uniswap v4 Hook — gates swaps via `beforeSwap` oracle check |
| **TrustScoreOracle**     | Base Sepolia   | `0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139` | Legacy oracle — behavioral + review scores (Hookathon dev)  |
| **MaiatPassport**        | Base Mainnet   | _(Phase 2)_                                  | Soulbound ERC-721 — auto-minted on wallet connect           |
| **MaiatTrustConsumer**   | Base Sepolia   | _(planned)_                                  | Chainlink CRE consumer — receives signed reports, batch-updates TrustScoreOracle |

**Base Builder Code:** `bc_cozhkj23` (ERC-8021, appended to all swap calldata)

**Owner/Operator separation:** Cold wallet deployer (owner, upgrade-only) + ACP hot wallet operator (`0xB1e504aE1ce359B4C2a6DC5d63aE6199a415f312`, write-only for scores + attestations).

---

## On-Chain Integrations

### EAS (Ethereum Attestation Service)

- **Schema UID**: `0x24b0db687434f15057bef6011b95f1324f2c38af06d0e636aea1c58bf346d802`
- Gated by `MaiatReceiptResolver`. Attestations made via this schema are verified "Maiat Receipts".
- Base Mainnet EAS contract: `0x4200000000000000000000000000000000000021`

### Uniswap v4 Hook (Hookathon)

- **Project:** AgenticCommerceHook | **ID:** HK-UHI8-0765
- `beforeSwap` reads TrustScoreOracle → blocks or surcharges low-trust tokens
- Dynamic fee adjustment based on trust score

### Base Builder Code

- Registered at base.dev: `bc_cozhkj23`
- Zero gas overhead (ERC-8021 data suffix)

---

## Feedback Loop

```
User/Agent action → QueryLog/TrustReview (DB)
                  → recalculate AgentScore (behavioral 70% + reviews 30%)
                  → Oracle Sync cron (every 6h → on-chain TrustScoreOracle)
                  → EAS Auto-Attest cron (daily → permanent attestations)
```

---

## Packages

| Package                                                  | npm                                                                                                                           | Description                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`maiat-sdk`](packages/sdk/)                             | [![npm](https://img.shields.io/npm/v/maiat-sdk)](https://www.npmjs.com/package/maiat-sdk)                                     | Core SDK — trust scores, token safety, swap verification for AI agents |
| [`@jhinresh/viem-guard`](packages/guard/)                | [![npm](https://img.shields.io/npm/v/@jhinresh/viem-guard)](https://www.npmjs.com/package/@jhinresh/viem-guard)               | Viem middleware — auto-checks trust before every transaction           |
| [`@jhinresh/mcp-server`](packages/mcp-server/)           | [![npm](https://img.shields.io/npm/v/@jhinresh/mcp-server)](https://www.npmjs.com/package/@jhinresh/mcp-server)               | MCP Server — query trust from Claude, GPT, or any MCP-compatible AI    |
| [`@jhinresh/elizaos-plugin`](packages/elizaos-plugin/)   | [![npm](https://img.shields.io/npm/v/@jhinresh/elizaos-plugin)](https://www.npmjs.com/package/@jhinresh/elizaos-plugin)       | ElizaOS plugin — trust-gate actions, evaluators, providers             |
| [`@jhinresh/agentkit-plugin`](packages/agentkit-plugin/) | [![npm](https://img.shields.io/npm/v/@jhinresh/agentkit-plugin)](https://www.npmjs.com/package/@jhinresh/agentkit-plugin)     | Coinbase AgentKit plugin — auto-check trust before transactions        |
| [`@jhinresh/game-maiat-plugin`](packages/game-plugin/)   | [![npm](https://img.shields.io/npm/v/@jhinresh/game-maiat-plugin)](https://www.npmjs.com/package/@jhinresh/game-maiat-plugin) | GAME SDK plugin — check_trust_score, gate_swap, batch_check            |
| [`@jhinresh/virtuals-plugin`](packages/virtuals-plugin/) | [![npm](https://img.shields.io/npm/v/@jhinresh/virtuals-plugin)](https://www.npmjs.com/package/@jhinresh/virtuals-plugin)     | Virtuals GAME SDK plugin — trust-gate agent transactions               |

---

## Cron Jobs (Vercel)

| Job               | Schedule        | Purpose                                   |
| ----------------- | --------------- | ----------------------------------------- |
| `index-agents`    | Daily 02:00 UTC | Index new agents from ACP on-chain        |
| `auto-attest`     | Daily 03:00 UTC | EAS attestations for ACP interactions     |
| `oracle-sync`     | Every 6h        | Sync trust scores to on-chain oracle      |
| `resolve-markets` | Every 6h        | Settle prediction markets past `closesAt` |

---

## Tech Stack

| Layer       | Tech                                          |
| ----------- | --------------------------------------------- |
| Framework   | Next.js 15 (App Router)                       |
| Database    | PostgreSQL + Prisma (Supabase)                |
| Auth        | Privy (wallet connect)                        |
| AI          | Google Gemini (review quality, deep insights) |
| Chain       | Base (primary)                                |
| Oracle      | TrustScoreOracle + Chainlink CRE (planned)    |
| Attestation | EAS on Base                                   |
| Deployment  | Vercel (web) · Railway (ACP agent)            |

---

## Local Development

```bash
git clone https://github.com/JhiNResH/maiat-protocol.git
cd maiat-protocol
npm install

cp .env.example .env
# Required: DATABASE_URL, DIRECT_URL
# Optional: GEMINI_API_KEY, MAIAT_ADMIN_PRIVATE_KEY, CRON_SECRET

npx prisma generate
npx prisma db push
npm run dev
```

---

## Related

- **[maiat-acp](https://github.com/JhiNResH/maiat-acp)** — ACP agent runtime + CLI + offerings
- **[Virtuals ACP](https://app.virtuals.io/acp)** — Agent Commerce Protocol
- **[EAS on Base](https://base.easscan.org)** — Ethereum Attestation Service

---

## License

MIT

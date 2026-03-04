<p align="center">
  <img src="https://raw.githubusercontent.com/JhiNResH/maiat-protocol/main/public/maiat-logo.jpg" width="120" alt="Maiat" />
</p>

<h1 align="center">Maiat Protocol</h1>

<p align="center">
  <strong>The trust layer for agentic commerce.</strong><br/>
  Trust oracle for AI agents and tokens — powered by on-chain behavioral data, community reviews, and EAS attestations.
</p>

<p align="center">
  <a href="https://maiat-protocol.vercel.app">Live App</a> ·
  <a href="https://maiat-protocol.vercel.app/docs">API Docs</a> ·
  <a href="https://app.virtuals.io/acp">ACP Agent #3723</a>
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

## What It Does

| Use Case               | Endpoint                               | Fee      |
| ---------------------- | -------------------------------------- | -------- |
| Token honeypot check   | `GET /api/v1/token/:address`           | Free     |
| Agent trust score      | `GET /api/v1/agent/:address`           | Free     |
| Deep agent analysis    | `GET /api/v1/agent/:address/deep`      | Free     |
| Trust-gated swap quote | `POST /api/v1/swap/quote`              | Free     |
| Browse 2,200+ agents   | `GET /api/v1/agents`                   | Free     |
| Submit review          | `POST /api/v1/review`                  | 2 Scarab |
| Trust Passport         | `GET /api/v1/wallet/:address/passport` | Free     |

---

## ACP Offerings (Virtuals Protocol)

Wallet: `0xAf1aE6F344c60c7Fe56CB53d1809f2c0B997a2b9`

| Offering           | Fee           | Description                                            |
| ------------------ | ------------- | ------------------------------------------------------ |
| `token_check`      | $0.01         | Honeypot detection, tax analysis, risk flags           |
| `agent_trust`      | $0.02         | Behavioral trust score from on-chain job history       |
| `agent_deep_check` | $0.10         | Percentile rank, risk flags, tier, recommendation      |
| `trust_swap`       | $0.05 + 0.15% | Trust-gated Uniswap swap (calldata withheld if unsafe) |

---

## Smart Contracts (Base Mainnet)

| Contract                 | Address                                      | Purpose                                                     |
| ------------------------ | -------------------------------------------- | ----------------------------------------------------------- |
| **MaiatOracle**          | `0xdd046b037084e0aa23cfd2182318db28ca4b83a0` | On-chain trust scores for AI agents (updated dynamically)   |
| **MaiatReceiptResolver** | `0x601063661174bc7cfab4b2622ccc3ed41db0dd09` | EAS Resolver gating attestations only to the Maiat Attester |
| **TrustScoreOracle**     | `0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139` | (Legacy/Sepolia) behavioral + reviews                       |
| **TrustGateHook**        | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` | Uniswap v4 Hook — gates swaps based on oracle scores        |
| **MaiatPassport**        | —                                            | Soulbound ERC-721 — auto-minted on wallet connect           |
| **MaiatTrustConsumer**   | —                                            | Chainlink CRE consumer for decentralized oracle updates     |

**Base Builder Code:** `bc_cozhkj23` (ERC-8021, appended to all swap calldata)

---

## On-Chain Integrations

### EAS (Ethereum Attestation Service)

- **Schema UID**: `0xff334be59dc68d965e7e3f9944caf49af9523c3125d1499b72a19dac198358d2`
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

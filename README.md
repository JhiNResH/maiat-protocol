# Maiat Protocol

**Trust infrastructure for agentic commerce.**

Verified reviews, AI-powered trust scores, and Uniswap v4 trust-gated swaps — so agents and users can make informed decisions before transacting.

---

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           Maiat Protocol             │
                    └─────────────┬───────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
   ┌─────▼─────┐          ┌──────▼──────┐          ┌──────▼──────┐
   │  Review    │          │  Trust Score │          │  Swap Trust  │
   │  Engine    │          │  Oracle      │          │  Gate (v4)   │
   └─────┬─────┘          └──────┬──────┘          └──────┬──────┘
         │                       │                        │
   ┌─────▼─────┐          ┌──────▼──────┐          ┌──────▼──────┐
   │  Gemini AI │          │  Base        │          │  Uniswap    │
   │  Verify    │          │  (on-chain)  │          │  PoolManager│
   └───────────┘          └─────────────┘          └─────────────┘
```

### How It Works

1. **Users/Agents submit reviews** for crypto projects (DeFi protocols, AI agents, tokens)
2. **Gemini AI verifies** each review for authenticity (spam detection, sentiment analysis)
3. **Trust scores are computed** by the Scarab engine based on verified reviews
4. **Scores are stored on-chain** via TrustScoreOracle (Base)
5. **TrustGateHook blocks risky swaps** — Uniswap v4 hook checks trust score before allowing trades

### Core Components

| Component | Description |
|-----------|-------------|
| **TrustScoreOracle** | On-chain registry of trust scores per token/agent (Solidity) |
| **TrustGateHook** | Uniswap v4 `beforeSwap` hook — blocks swaps for low-trust tokens |
| **Review API** | Submit & verify reviews with AI-powered authenticity detection |
| **Scarab Engine** | Automated reputation scoring from verified reviews |
| **Agent API (v1)** | Open REST endpoints for agent-to-agent trust queries |

---

## Supported Chains

| Chain | Status | Components |
|-------|--------|------------|
| **Base** | ✅ Deployed (Sepolia) | Oracle + TrustGateHook |
| **BNB** | 🔜 Planned | Oracle |
| **ARC (Circle)** | 🔜 Planned | Oracle + USDC payments |
| **Solana** | 🔜 API-only | REST API |

### Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| TrustScoreOracle | `0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139` |
| TrustGateHook | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` |
| MaiatTrustConsumer | `0x1080cf8074130ba6e491ba3424b07baff2b92204` |

---

## Agent SDKs

Plug-and-play trust scoring for every major agent framework.

| Package | Registry | Install |
|---------|----------|---------|
| [![npm](https://img.shields.io/npm/v/@maiat/agentkit-plugin?label=%40maiat%2Fagentkit-plugin&color=blue)](https://www.npmjs.com/package/@maiat/agentkit-plugin) | npm | `npm i @maiat/agentkit-plugin` |
| [![npm](https://img.shields.io/npm/v/@maiat/elizaos-plugin?label=%40maiat%2Felizaos-plugin&color=blue)](https://www.npmjs.com/package/@maiat/elizaos-plugin) | npm | `npm i @maiat/elizaos-plugin` |
| [![npm](https://img.shields.io/npm/v/@maiat/mcp-server?label=%40maiat%2Fmcp-server&color=blue)](https://www.npmjs.com/package/@maiat/mcp-server) | npm | `npm i @maiat/mcp-server` |
| [![npm](https://img.shields.io/npm/v/@maiat/virtuals-plugin?label=%40maiat%2Fvirtuals-plugin&color=blue)](https://www.npmjs.com/package/@maiat/virtuals-plugin) | npm | `npm i @maiat/virtuals-plugin` |

Also available on [GitHub Packages](https://github.com/JhiNResH/maiat-protocol/packages).

### Coinbase AgentKit

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { maiatTrustPlugin } from "@maiat/agentkit-plugin";

const plugin = maiatTrustPlugin({ minScore: 3.0 });
// Provides: maiat_check_trust, maiat_gate_transaction actions
agent.use(plugin);
```

### ElizaOS (ai16z)

```typescript
import { maiatPlugin } from "@maiat/elizaos-plugin";

const agent = new ElizaAgent({
  plugins: [maiatPlugin({ minScore: 3.0 })],
});
// Agent can now answer: "Is 0x... safe?" with live trust data
```

### Virtuals GAME SDK

```typescript
import { GameAgent } from "@virtuals-protocol/game";
import { createMaiatWorker } from "@maiat/virtuals-plugin";

const maiatWorker = await createMaiatWorker({ minScore: 3.0 });

const agent = new GameAgent(process.env.GAME_API_KEY!, {
  name: "TrustGuardAgent",
  goal: "Only interact with trusted on-chain addresses",
  workers: [maiatWorker],
});

await agent.init();
await agent.run(10);
```

### Claude / Any MCP-compatible LLM

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "maiat": {
      "command": "npx",
      "args": ["@maiat/mcp-server"],
      "env": { "MAIAT_API_URL": "https://maiat-protocol.vercel.app" }
    }
  }
}
```

```bash
# Or run standalone
npx @maiat/mcp-server
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/JhiNResH/maiat-protocol.git
cd maiat-protocol

# Install
npm install

# Environment
cp .env.example .env
# Fill in: DATABASE_URL, GEMINI_API_KEY, PRIVY_APP_ID, UPSTASH_REDIS_*

# Database
npx prisma generate
npx prisma db push
npm run seed

# Run
npm run dev
# → http://localhost:3000
```

### Contracts

```bash
cd contracts
forge build
forge test

# Deploy
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast

# Seed scores
ORACLE_ADDRESS=0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139 forge script script/Interact.s.sol:SeedScores \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

---

## API Reference

### Open API (v1)

No SDK needed. Just HTTP.

#### `POST /api/v1/trust-score`

Query trust score for any project or agent.

```bash
curl -X POST https://maiat.xyz/api/v1/trust-score \
  -H "Content-Type: application/json" \
  -d '{"projectName": "Uniswap"}'
```

**Response:**
```json
{
  "found": true,
  "project": {
    "id": "clm...",
    "name": "Uniswap",
    "category": "DeFi"
  },
  "trustScore": {
    "overall": 85,
    "reviewCount": 12,
    "verifiedCount": 8,
    "avgRating": 4.2
  },
  "recommendation": "TRUSTED",
  "attestation": {
    "chain": "base-sepolia",
    "oracle": "0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139"
  }
}
```

**Parameters:** `projectId`, `projectName`, or `agentAddress` (at least one required)

**Rate Limits:** 100 req/day (free), unlimited with API key or x402 payment

---

#### `POST /api/v1/deep-insight`

AI-powered deep analysis with risk assessment.

```bash
curl -X POST https://maiat.xyz/api/v1/deep-insight \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"projectName": "Aave"}'
```

**Response:**
```json
{
  "project": { "id": "...", "name": "Aave", "category": "DeFi" },
  "analysis": {
    "score": 88,
    "status": "established",
    "summary": "Well-audited lending protocol with strong TVL...",
    "features": ["Multi-chain", "Audited", "DAO-governed"],
    "warnings": ["Smart contract risk"]
  },
  "reviews": {
    "total": 24,
    "verified": 18,
    "avgRating": 4.5,
    "ratingDistribution": { "1": 0, "2": 1, "3": 2, "4": 8, "5": 13 }
  },
  "recommendation": {
    "signals": ["HIGH_AI_SCORE", "STRONG_COMMUNITY", "MOSTLY_VERIFIED"],
    "verdict": "LIKELY_SAFE",
    "confidence": "HIGH"
  }
}
```

---

#### `POST /api/reviews`

Submit a review.

```bash
curl -X POST https://maiat.xyz/api/reviews \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "clm...",
    "content": "Great protocol, used it for 6 months...",
    "rating": 5,
    "walletAddress": "0x..."
  }'
```

---

#### `POST /api/agent-review`

AI agent submits an automated review (signed with agent wallet).

```bash
curl -X POST https://maiat.xyz/api/agent-review \
  -H "Content-Type: application/json" \
  -d '{"projectName": "Uniswap"}'
```

---

### Internal APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trust-score` | GET | Get trust score for a project |
| `/api/reputation` | GET | Get user reputation data |
| `/api/leaderboard` | GET | Top reviewers leaderboard |
| `/api/search` | GET | Search projects |
| `/api/verify-review` | POST | AI verify a review |
| `/api/verify-base` | POST | Base Verify (anti-sybil) |
| `/api/scarab/*` | Various | Scarab token operations |

---

## Data Model

```
User ──┬── Review ──── Project
       │      │
       │      └── Vote
       │
       └── ScarabBalance
                │
                └── ScarabTransaction
```

- **User** — wallet address, display name, reputation score
- **Project** — crypto project/agent with category, avg rating, review count
- **Review** — rating (1-5), content, verification status, on-chain hash
- **Vote** — upvote/downvote on reviews
- **Scarab** — gamified reputation tokens (earn by reviewing, spend on boosts)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, Tailwind CSS |
| Auth | Privy (wallet connect) |
| Database | PostgreSQL + Prisma ORM |
| AI | Google Gemini (review verification) |
| Contracts | Solidity, Foundry, Uniswap v4 |
| Chain | Base (primary), multi-chain planned |
| Rate Limiting | Upstash Redis |

---

## Agent SDKs & Plugins

Plug Maiat trust scoring directly into your agent framework — no custom API calls needed.

### Available Packages

| Package | Framework | npm |
|---------|-----------|-----|
| `@jhinresh/mcp-server` | Claude / OpenClaw / any MCP host | [![npm](https://img.shields.io/npm/v/@jhinresh/mcp-server)](https://www.npmjs.com/package/@jhinresh/mcp-server) |
| `@jhinresh/elizaos-plugin` | ElizaOS / ai16z | [![npm](https://img.shields.io/npm/v/@jhinresh/elizaos-plugin)](https://www.npmjs.com/package/@jhinresh/elizaos-plugin) |
| `@jhinresh/agentkit-plugin` | Coinbase AgentKit | [![npm](https://img.shields.io/npm/v/@jhinresh/agentkit-plugin)](https://www.npmjs.com/package/@jhinresh/agentkit-plugin) |

---

### `@jhinresh/mcp-server` — MCP (Claude / OpenClaw)

```bash
npm install @jhinresh/mcp-server
```

Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "maiat": {
      "command": "npx",
      "args": ["-y", "@jhinresh/mcp-server"],
      "env": { "MAIAT_API_URL": "https://maiat-protocol.vercel.app" }
    }
  }
}
```

Tools exposed: `maiat_check_trust`, `maiat_check_token`, `maiat_batch_check`

---

### `@jhinresh/elizaos-plugin` — ElizaOS / ai16z

```bash
npm install @jhinresh/elizaos-plugin
```

```typescript
import { maiatPlugin } from "@jhinresh/elizaos-plugin";

const agent = new ElizaAgent({
  plugins: [maiatPlugin({ minScore: 3.0 })],
});
// Agent now auto-gates swaps — rejects addresses with trust score < 3.0
```

Actions: `CHECK_TRUST` · Evaluators: `TRUST_GATE` · Providers: `TRUST_DATA`

---

### `@jhinresh/agentkit-plugin` — Coinbase AgentKit

```bash
npm install @jhinresh/agentkit-plugin
```

```typescript
import { MaiatTrustPlugin } from "@jhinresh/agentkit-plugin";

const plugin = new MaiatTrustPlugin({ minScore: 3.0 });
// Wrap any AgentKit action with trust gating
const safeTransfer = plugin.wrapAction(transferAction);
```

---

## Roadmap

- [x] Review submission + AI verification
- [x] TrustScoreOracle on Base
- [x] TrustGateHook (Uniswap v4)
- [x] Open API v1 (trust-score + deep-insight)
- [ ] Multi-chain deployment (BNB, ARC, Solana)
- [ ] x402 payment integration (USDC)
- [ ] Trust badge embeds for project websites
- [x] Agent SDK — MCP server, ElizaOS plugin, AgentKit plugin (npm)
- [ ] Mainnet deployment

---

## License

MIT

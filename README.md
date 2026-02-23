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
| TrustScoreOracle | `0x0098d35d396a929c438168825ae2b16184aa3aaf` |
| TrustGateHook | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` |
| MaiatTrustConsumer | `0xd11884c617090da8eaa3a541fe5f42c79de7567b` |

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
ORACLE_ADDRESS=0x0098d35d396a929c438168825ae2b16184aa3aaf forge script script/Interact.s.sol:SeedScores \
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
    "oracle": "0x0098d35d396a929c438168825ae2b16184aa3aaf"
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

## Roadmap

- [x] Review submission + AI verification
- [x] TrustScoreOracle on Base
- [x] TrustGateHook (Uniswap v4)
- [x] Open API v1 (trust-score + deep-insight)
- [ ] Multi-chain deployment (BNB, ARC, Solana)
- [ ] x402 payment integration (USDC)
- [ ] Trust badge embeds for project websites
- [ ] Agent SDK (npm package)
- [ ] Mainnet deployment

---

## License

MIT

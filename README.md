# Maiat Protocol

**Trust infrastructure for agentic commerce.**

Maiat provides verified reviews, AI-powered trust scores, and on-chain trust-gated swaps — so agents and users can make informed decisions before transacting.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Agent /     │────▶│  Maiat API   │────▶│  Trust Score     │
│  User        │     │  (x402 pay)  │     │  Oracle (EVM)    │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │                       │
                    ┌──────┴──────┐          ┌──────┴──────┐
                    │  Gemini AI  │          │ TrustGate   │
                    │  Verify     │          │ Hook (v4)   │
                    └─────────────┘          └─────────────┘
```

### Core Components

- **TrustScoreOracle** — On-chain registry of trust scores per token/agent
- **TrustGateHook** — Uniswap v4 hook that checks trust scores before allowing swaps
- **Review API** — Submit and verify reviews with AI-powered authenticity detection
- **Scarab Engine** — Automated reputation scoring based on verified reviews
- **Agent API** — x402-gated endpoints for agent-to-agent trust queries

## Supported Chains

| Chain | Status | Contracts |
|-------|--------|-----------|
| Base | ✅ Live (Sepolia) | Oracle + Hook |
| BNB | 🔜 Planned | Oracle |
| ARC (Circle) | 🔜 Planned | Oracle |
| Solana | 🔜 API-only | — |

## Quick Start

```bash
# Install
npm install

# Setup database
npx prisma generate
npx prisma db push

# Seed demo data
npm run seed

# Run
npm run dev
```

## API Reference

### Trust Score Query
```
POST /api/trust-score/query
Body: { "projectId": "..." }
Returns: { "score": 85, "reviewCount": 12, "breakdown": {...} }
```

### Submit Review
```
POST /api/reviews
Body: { "projectId": "...", "content": "...", "rating": 5, "walletAddress": "0x..." }
Returns: { "id": "...", "verified": true, "authenticityScore": 82 }
```

### Agent Trust Query (x402)
```
POST /api/agent-review
Headers: { "X-402-Payment": "..." }
Body: { "agentId": "...", "query": "is this agent safe?" }
Returns: { "trustScore": 85, "analysis": "..." }
```

## Contracts

```bash
cd contracts
forge build
forge test
forge script script/Deploy.s.sol --rpc-url <RPC_URL> --private-key <KEY> --broadcast
```

## License

MIT

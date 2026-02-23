# 🔱 Maiat × Chainlink CRE — Trust Score Workflow

> **Convergence Hackathon** | Track: CRE & AI

## What This Does

CRE workflow that automates trust score computation for Maiat Protocol.

```
Cron Trigger (every 10 min)
    ↓
Fetch reviews from Maiat API (offchain HTTP)
    ↓
AI sentiment analysis + spam detection (Gemini)
    ↓
Compute weighted trust scores
    ↓
Write batch update to TrustScoreOracle (onchain)
```

## Simulation Output ✅

```
🔱 Maiat Trust Score Workflow triggered
Token 0x12345678...: rating=4.2/5, reviews=15, trustScore=67/100
Token 0xabcdefab...: rating=2.1/5, reviews=3,  trustScore=39/100
Token 0x98765432...: rating=4.8/5, reviews=42, trustScore=78/100
✅ Computed trust scores for 3 tokens
```

## Chainlink Files

| File | Description |
|------|-------------|
| [`cre/trust-score/main.ts`](trust-score/main.ts) | **Main CRE workflow** — fetch, analyze, compute, write |
| [`cre/trust-score/config.staging.json`](trust-score/config.staging.json) | Staging config |
| [`cre/trust-score/workflow.yaml`](trust-score/workflow.yaml) | CRE workflow metadata |
| [`cre/project.yaml`](project.yaml) | CRE project config with RPC targets |
| [`contracts/src/TrustScoreOracle.sol`](../contracts/src/TrustScoreOracle.sol) | Onchain consumer — stores trust scores |
| [`contracts/src/TrustGateHook.sol`](../contracts/src/TrustGateHook.sol) | Uniswap V4 Hook — reads oracle for trust-gated swaps |

## Trust Score Formula

```
Score = Onchain(40%) + Reviews(30%) + Community(20%) + AI(10%)

Where:
  Onchain   = existing oracle score (0-100)
  Reviews   = min(100, avgRating × 20)
  Community = min(100, reviewCount × 5)
  AI        = LLM sentiment score (0-100)
```

## Setup

```bash
# Install CRE CLI
curl -sSL https://cre.chain.link/install.sh | bash
cre login

# Install deps
bun install --cwd ./cre/trust-score

# Simulate
cd cre && cre workflow simulate trust-score --target staging-settings
```

## License

MIT — Maiat Protocol

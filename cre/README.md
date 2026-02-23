# 🔱 Maiat × Chainlink CRE — Trust Score Workflow

> **Convergence Hackathon Submission** | Track: CRE & AI

## What This Does

This CRE workflow automates trust score computation for the Maiat Protocol — trust infrastructure for agentic commerce.

**Flow:**
```
Cron Trigger (every 10 min)
    ↓
Fetch reviews from Maiat API (offchain HTTP)
    ↓
LLM sentiment analysis + spam detection (Gemini AI)
    ↓
Compute weighted trust scores
    ↓
Write batch update to TrustScoreOracle (onchain)
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Chainlink CRE DON                       │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌───────────────────┐  │
│  │  Cron     │───▶│  HTTP    │───▶│  Gemini LLM       │  │
│  │  Trigger  │    │  Fetch   │    │  Sentiment + Spam │  │
│  └──────────┘    │  Reviews │    └────────┬──────────┘  │
│                  └──────────┘             │              │
│                                           ▼              │
│                            ┌──────────────────────────┐  │
│                            │  Compute Trust Scores    │  │
│                            │  weighted: 40% onchain + │  │
│                            │  30% reviews + 20% comm  │  │
│                            │  + 10% AI sentiment      │  │
│                            └────────────┬─────────────┘  │
│                                         ▼                │
│                            ┌──────────────────────────┐  │
│                            │  Write to Oracle         │  │
│                            │  (Base Sepolia/Mainnet)  │  │
│                            └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Chainlink Files

| File | Description |
|------|-------------|
| [`cre/trust-score-workflow/main.ts`](trust-score-workflow/main.ts) | **Main CRE workflow** — triggers, fetches, analyzes, writes |
| [`cre/trust-score-workflow/config.staging.json`](trust-score-workflow/config.staging.json) | Staging config (Base Sepolia) |
| [`cre/trust-score-workflow/config.production.json`](trust-score-workflow/config.production.json) | Production config (Base Mainnet) |
| [`cre/trust-score-workflow/workflow.yaml`](trust-score-workflow/workflow.yaml) | CRE workflow metadata |
| [`cre/project.yaml`](project.yaml) | CRE project config with RPC targets |
| [`cre/secrets.yaml`](secrets.yaml) | Secret references (API keys, private key) |
| [`contracts/src/TrustScoreOracle.sol`](../contracts/src/TrustScoreOracle.sol) | **Onchain consumer** — stores trust scores |
| [`contracts/src/TrustGateHook.sol`](../contracts/src/TrustGateHook.sol) | **Uniswap V4 Hook** — reads oracle for trust-gated swaps |

## How It Integrates

1. **Blockchain ↔ External API**: Reads review data from Maiat REST API, writes trust scores to Base Sepolia
2. **AI/LLM Integration**: Uses Google Gemini for review sentiment analysis and spam detection
3. **CRE Capabilities Used**: `CronCapability`, `HTTPClient`, `EVMClient`, `runtime.report()`, `runtime.runInNodeMode()`, `consensusMedianAggregation`

## Setup

### Prerequisites
- [CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation/macos-linux) installed
- [Bun](https://bun.sh) >= 1.2.21
- CRE account at [cre.chain.link](https://cre.chain.link)
- Funded Base Sepolia account

### Quick Start

```bash
# 1. Login to CRE
cre login

# 2. Install dependencies
cd cre/trust-score-workflow
bun install

# 3. Configure .env
cp ../.env.example ../.env
# Edit with your keys

# 4. Simulate
cre workflow simulate --target staging-settings

# 5. Deploy (Early Access required)
cre workflow deploy --target staging-settings
```

## Trust Score Formula

```
Score = Onchain(40%) + Reviews(30%) + Community(20%) + AI(10%) + Adjustments

Where:
  Onchain    = existing oracle score (or 50 base)
  Reviews    = min(100, avgRating × 20)
  Community  = min(100, reviewCount × 5)
  AI         = LLM sentiment score (0-100)
  Adjustments = spam penalty (-20 if >50% spam) + AI trust modifier (-20 to +20)
```

## License

MIT — Maiat Protocol

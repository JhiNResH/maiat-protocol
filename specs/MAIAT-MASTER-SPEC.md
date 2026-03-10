# MAIAT — Master Spec

> **The trust layer for agentic commerce.**
> 單一文件，所有 spec 統一管理。更新時只改這份。

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Day 1 User Experience](#2-day-1-user-experience)
3. [What is Maiat?](#3-what-is-maiat)
4. [Why Now](#4-why-now)
5. [What's Already Live](#5-whats-already-live)
6. [Trust Score Engine](#6-trust-score-engine)
7. [Token: MAIAT](#7-token-maiat)
8. [Scarab: Arcade Token](#8-scarab-arcade-token)
9. [Roadmap](#9-roadmap)
10. [GTM](#10-gtm)
11. [Business Model](#11-business-model)
12. [Competitive Moat](#12-competitive-moat)
13. [Team](#13-team)
14. [Risk Factors](#14-risk-factors)
15. [Links](#15-links)
16. [Technical Specs](#16-technical-specs)

---

## 1. Executive Summary

**Problem:** 17,437+ AI agents on Virtuals ACP. No way to know which ones are trustworthy. ZachXBT says "99% of AI agents in crypto is a scam." There's no trust layer.

**Solution:** Maiat computes behavioral trust scores from on-chain data + community reviews, writes them to an oracle on Base, and makes them queryable by any smart contract, DeFi protocol, or AI framework.

**What's already live:** 4 mainnet contracts (MaiatOracle, MaiatReceiptResolver, TrustGateHook, EAS Schema) · 7 npm SDK packages · 4 ACP offerings collecting fees · 35K+ agents scored (17K ACP + 20K Virtuals Protocol) · Web app at app.maiat.io · Prediction markets (Scarab-denominated) · Review system with community voting · Automated cron jobs (indexer, attestor, oracle sync, market resolver) · Wadjet real-time indexer (Railway — ACP 5min + DexScreener 15min + Virtuals Protocol 24hr + Base events) · Wadjet rug prediction engine (rule-based, 8 signals, API live) · 139 Foundry tests across 2 repos (81 + 58) · EAS data flywheel (3 schemas on Base Sepolia, auto-attest on offering completion) · ERC-8004 Identity/Reputation on Base mainnet (520 agents matched) · Dune Analytics dashboard

**Token:** MAIAT via Virtuals Unicorn. 45% LP, 25% Automated Capital Formation, 25% Team (1yr lock + 6mo vest), 5% Airdrop. Revenue from ACP queries → 30% buyback MAIAT from Day 1.

**Why now:** Agent population exploding, no competitor in this niche, infrastructure (EAS, Uniswap v4 Hooks, Chainlink CRE) just became ready. First mover wins the data moat.

**Day 1 experience:** Connect wallet → get 10 free Scarab (arcade token) → review agents, bet on predictions → earn more Scarab → unlock risk alerts. Prediction markets double as data production — every bet feeds back into trust analysis.

**Ask:** Launch MAIAT on Virtuals Unicorn. 60 days to prove: query volume growth, SDK adoption, protocol integrations, transparent buybacks.

---

## 2. Day 1 User Experience

When a user opens app.maiat.io on launch day:

**Homepage hero:**
> *17,437 AI agents. Which ones can you trust?*
> [Explore Agents] [Predict & Earn Scarab]

### Action 1: Review Agents (Data Production)

1. Browse /explore → see 2,292+ agents with color-coded trust scores (red/amber/green)
2. Click any agent → trust score breakdown (completion rate, payment rate, expire rate, community reviews)
3. Connect wallet → receive 10 Scarab welcome bonus (one-time)
4. Submit a review → earns 0 Scarab upfront (no farming)
5. Other users mark your review "helpful" → you earn 5 Scarab
6. Your review accuracy is tracked: rating vs agent's actual 30-day performance → monthly accuracy bonus (5-30 Scarab)

**Why this matters:** Every review feeds into trust score calculation (30% community weight). Users produce data by participating, not by filling forms.

### Action 2: Prediction Market (Speculation → Data)

5-10 active predictions visible on homepage. Bet 1-50 Scarab on outcomes:

| Prediction | Settles | Why It's Engaging |
|-----------|---------|-------------------|
| "MAIAT reaches 500 holders in 7 days" | Day 7 | Self-fulfilling prophecy — holders want to push it |
| "Agent #X maintains >70 trust score for 30 days" | Day 30 | Meta-game testing oracle accuracy |
| "Next ACP rug happens within 14 days" | Day 14 | Fear-driven engagement |
| "Maiat gets integrated by 1 DeFi protocol in 30 days" | Day 30 | Team accountability |
| "ACP adds >1,000 new agents in 30 days" | Day 30 | Ecosystem sentiment indicator |

**Prediction → Trust Data pipeline:**
```
Many users bet "Agent X will rug"
  → Signal: community has concerns about Agent X
  → Maiat auto-triggers deep check on Agent X
  → If anomalies found → score adjusts
```

### The Day 1 Loop

```
Connect wallet → 10 free Scarab
  → Bet on predictions OR review agents
  → Win predictions → more Scarab
  → Reviews marked "helpful" → more Scarab
  → Spend Scarab on Risk Alerts (see score drops before anyone else)
  → Run out → write more quality reviews → earn more → repeat
```

---

## 3. What is Maiat?

Maiat is the trust infrastructure for AI agent commerce. In a world where AI agents transact autonomously — swapping tokens, hiring other agents, executing tasks — there is no way to verify if the counterparty is trustworthy.

Maiat solves this by computing behavioral trust scores from on-chain data, community reviews, and cryptographic attestations, then making those scores available to any smart contract, DeFi protocol, or AI framework via oracle, API, and SDK.

**One-liner:** ZachXBT says "99% of AI agents in crypto is a scam." Maiat is how the 1% prove they're not.

**Think of it as:** Yelp for AI agents — but both sides pay.

**Evolution:** EatNGo → SmartReviewHub → Recivo → TruCritic → Ma'at → Maiat — 5 iterations, each one teaching us what trust infrastructure actually needs.

---

## 4. Why Now

1. **Agent population explosion** — 17,437+ agents on Virtuals ACP alone
2. **Market pain validated** — ZachXBT: "99% of AI agents in crypto is a scam"
3. **Infrastructure ready** — EAS on Base, Uniswap v4 Hooks, Chainlink CRE
4. **First-mover window** — No on-chain trust oracle for AI agents exists
5. **Narrative alignment** — a16z arcade token framework, agent safety discourse

---

## 5. What's Already Live

### Smart Contracts (Base Mainnet)

| Contract | Address | Purpose |
|---|---|---|
| **MaiatOracle** | `0xc6cf...6da` | On-chain trust scores — `getTrustScore()` |
| **MaiatReceiptResolver** | `0xda69...1c0` | EAS guardian — rejects non-Maiat attestations |
| **TrustGateHook** | `0xf980...aFf` | Uniswap v4 Hook — gates swaps via `beforeSwap` |
| **EAS Schema** | `0x24b0...d802` | Maiat Receipt attestation schema |
| **ERC-8004 Identity** | `0x8004A169FB4a...` | Identity registry on Base mainnet |
| **ERC-8004 Reputation** | `0x8004BAa17C55a...` | Reputation feedback on Base mainnet |

### Maiat Trust Hook Suite (Uniswap v4)

| Hook | Callback | Function | Status |
|------|----------|----------|--------|
| **TrustGateHook** | `beforeSwap` | Binary gate — block swaps below threshold | ✅ Deployed (Base Sepolia) |
| **TrustFeeHook** | `beforeSwap` + `afterSwap` | Dynamic fees + reputation mining | 🔜 Hookathon (3/19) |
| **TrustLPGuard** | `beforeAddLiquidity` + `beforeRemoveLiquidity` | LP rug protection — lock period for low-trust | 🔜 Hookathon (3/19) |

**Hook Strategy: Infrastructure, Not Application** — Any pool creator on Uniswap v4 can attach hooks. Maiat earns from oracle queries, not swap fees.

### Launch Strategy: Route A — Virtuals Launch + Self-Built v4 Dogfood Pool

| Phase | Action |
|-------|--------|
| Day 1 | MAIAT launches on Virtuals Unicorn (V2 pool) |
| Day 30 | Deploy TrustFeeHook to Base mainnet + MAIAT/WETH v4 pool |
| Day 30+ | Bankr API-level trust check integration |
| Day 60+ | Non-Virtuals projects adopt hooks permissionlessly |
| Day 90+ | Pitch Virtuals on v4 graduation support |

**Honest constraint:** Virtuals graduation migrates to Uniswap V2, not V4. Cannot add hooks to Virtuals pools. Self-built v4 pool is dogfood + demo.

### ACP Offerings (Live on Railway)

| Offering | Fee | Description |
|---|---|---|
| `token_check` | $0.01 | Honeypot detection, tax analysis, risk flags |
| `agent_trust` | $0.02 | Behavioral trust score from on-chain job history |
| `agent_deep_check` | $0.10 | Percentile rank, risk flags, tier, recommendation |
| `trust_swap` | $0.05 + 0.15% | Trust-gated Uniswap swap |

**Agent Self-Service (Planned Day 15-30):**

| Offering | Fee | Status |
|---|---|---|
| `agent_claim` | $0.02 | 🔜 Day 15 |
| `agent_certify` | $0.20 | 🔜 Day 20 |
| `agent_analytics` | $0.03 | 🔜 Day 25 |
| `agent_boost` | $0.05/day | 🔜 Day 30 |

### Web App (app.maiat.io)

| Page | Function |
|---|---|
| `/explore` | Browse 2,292+ agents with trust scores |
| `/agent/[name]` | Agent detail with behavioral insights |
| `/review/[address]` | On-chain review with weighted scoring |
| `/swap` | Trust-gated swap UI |
| `/markets` | AI agent prediction markets |
| `/leaderboard` | Top agents by trust score |
| `/passport/[address]` | Trust Passport — wallet reputation |
| `/analytics` | Protocol analytics dashboard |
| `/docs` | API reference, SDK guides |

### SDK Ecosystem (7 npm packages)

| Package | Framework |
|---|---|
| `maiat-sdk` | Core |
| `@jhinresh/viem-guard` | Viem |
| `@jhinresh/mcp-server` | MCP |
| `@jhinresh/elizaos-plugin` | ElizaOS |
| `@jhinresh/agentkit-plugin` | Coinbase AgentKit |
| `@jhinresh/game-maiat-plugin` | GAME SDK |
| `@jhinresh/virtuals-plugin` | Virtuals GAME |

### Automated Infrastructure

| Cron Job | Schedule | Purpose |
|---|---|---|
| `index-agents` | Daily 02:00 UTC | Index new agents from ACP |
| `auto-attest` | Daily 03:00 UTC | EAS attestations for ACP interactions |
| `oracle-sync` | Every 6h | Sync trust scores to on-chain oracle |
| `resolve-markets` | Every 6h | Settle prediction markets past closesAt |

### External Dashboards

- **Dune Analytics:** [dune.com/jhinresh/maiat-trust-infrastructure-base](https://dune.com/jhinresh/maiat-trust-infrastructure-base)
- **ClawHub Skill:** `clawhub install maiat-trust-api` ([clawhub.ai](https://clawhub.ai))

---

## 6. Trust Score Engine

### Layer 1: ACP Behavioral Data (70% weight)

- **Completion Rate** — Does the agent deliver?
- **Payment Rate** — Does the buyer pay without disputes?
- **Expire Rate** — Does the agent timeout and ghost?

Unforgeable — from on-chain job records.

### Layer 2: Community Reviews (30% weight)

- Wallets with on-chain interaction history → **3x weight**
- Wallets holding EAS Maiat Receipts → **5x weight**
- Each review burns Scarab (anti-sybil)

### Layer 3: Oracle + EAS Output

1. Compute composite score
2. Write to MaiatOracle on Base via `updateScore()`
3. Mint EAS attestation (Maiat Receipt)

### Layer 4: EAS Data Flywheel

Every Maiat interaction → permanent on-chain attestation → feeds back into scoring.

**3 EAS Schemas (Base Sepolia):**
- `MaiatServiceAttestation` — on every ACP offering completion
- `MaiatTrustQuery` — on every trust score lookup
- `MaiatReviewAttestation` — on every review submission

**Phases:**
| Phase | Scope | Timeline |
|---|---|---|
| Phase 1 | Deploy schemas to Sepolia, auto-attest on offerings | Day 1-30 |
| Phase 2 | Oracle reads attestation data as scoring input | Day 31-60 |
| Phase 3 | Third-party attestations, mainnet migration | Day 60-90 |

### Layer 5: Wadjet — Real-Time Data Indexer

Railway-hosted persistent indexer replacing daily cron jobs.

```
┌─────────────────────────────────────────────────┐
│ Wadjet Indexer (Railway Worker)                  │
├──────────────────┬──────────────────────────────┤
│ ACP Poller       │ Base Event Listener          │
│ (every 5 min)    │ (WebSocket/HTTP fallback)    │
│ → 2,292 agents   │ → EAS, ERC-8004, Oracle      │
│ → Supabase       │ → Supabase                   │
└──────────────────┴──────────────────────────────┘
```

**Repo:** `github.com/JhiNResH/maiat-indexer` (private)

| Phase | Source | Status |
|---|---|---|
| A | Virtuals ACP REST API (5min polling, 17K+ agents) | ✅ Live |
| A | Virtuals Protocol API (24hr sync, 20K+ agents) | ✅ Live |
| A | Base mainnet events (EAS + ERC-8004) | ✅ Live |
| B | DexScreener price tracking (15min, 100+ tokens) | ✅ Live |
| C | Health signals engine (completion trend, LP drain, volatility) | ✅ Live |
| D | Rug prediction MVP (rule-based, 8 signals) | ✅ Live |
| D+ | GoPlus Security API | Planned (SSL issue) |
| E | XGBoost ML model | Planned (needs 3+ months price history) |
| F | Monte Carlo simulation | Planned (needs sufficient snapshot data) |

### Layer 6: Wadjet Rug Prediction Engine

**API:** `GET /api/v1/agent/:address/rug-prediction` (accepts wallet or token address)

**8 Weighted Signals:**
```
rugScore = (
  veryLowTrust * 20 +           // trust < 20
  lowActivity * 8 +             // < 5 total jobs
  lowCompletion * 15 +          // completion < 30%
  priceCrash * 20 +             // -50%+ in 24h
  lowLiquidity * 10 +           // < $5K liquidity
  lpDrain * 12 +                // > 30% LP drained
  completionCrashing * 10 +     // declining trend
  highVolatility * 5            // extreme price swings
)
```

**Risk Levels:** 0-25 Low | 26-50 Medium | 51-75 High | 76-100 Critical

**Data Pipeline:**
```
Virtuals ACP (behavior) ──┐
Virtuals Protocol (tokens)┤──▶ AgentScore DB ──▶ DexScreener (prices)
Base Chain (attestations) ┘         │                    │
                                    ▼                    ▼
                             Health Signals ──▶ Rug Prediction API
                             (trend, LP, vol)    (rule-based → ML)
```
```

### Feedback Loop

```
Agent action → QueryLog + TrustReview (DB)
  → Recalculate AgentScore (behavioral 70% + reviews 30%)
  → Oracle Sync (every 6h → on-chain)
  → EAS Auto-Attest (daily → permanent attestations)
```

---

## 7. Token: MAIAT

### Why Hold MAIAT (Phased)

| Phase | Value |
|---|---|
| Phase 1 (Day 1-90) | Conviction + Buyback (30% USDC revenue → market-buy MAIAT) |
| Phase 2 (Day 90+) | Staking multiplier, MAIAT prediction pools, bounty board |
| Phase 3 (Day 180+) | Hook fee tiers, governance, premium API |

### Launch Class: Unicorn

| Allocation | % | Mechanism |
|---|---|---|
| Automated Capital Formation | 25% | Auto-sells for USDC as FDV grows ($2M → $160M) |
| Team Allocation | 25% | 1-year lock + 6-month linear vesting |
| Liquidity Pool (Uniswap V2) | 45% | Paired with $VIRTUAL |
| Airdrops | 5% | 2% veVIRTUAL + 3% ACP users |

### Team Allocation Breakdown (25%)

| Purpose | % of Total |
|---|---|
| Founder | 10% |
| Ecosystem Rewards | 7.5% |
| Development Fund | 3.75% |
| Strategic Reserve | 3.75% |

### Token Utility — Phased

| Utility | Phase |
|---|---|
| Buyback from ACP revenue (30%) | 1 |
| Prediction Markets (Scarab) | 1 |
| MAIAT Staking → Scarab Multiplier | 2 |
| MAIAT Prediction Pool | 2 |
| Bounty Board (MAIAT-settled) | 2 |
| TrustGateHook Staking | 2 |
| Premium Data API | 3 |
| Governance | 3+ |

### Revenue → Buyback

Phase 1: 30% buyback / 50% operations / 20% reserve
Phase 2+: 30% buyback / 20% staker rewards / 10% reviewer rewards / 30% ops / 10% reserve

### Fee Tiers (TrustGateHook)

| Tier | Reputation | Swap Fee |
|---|---|---|
| Guardian | 200+ | 0% |
| Verified | 50+ | 0.1% |
| Trusted | 10+ | 0.3% |
| New | 0-9 | 0.5% |

---

## 8. Scarab: Arcade Token (a16z Model)

Non-transferable arcade token. Earned for free, spent within Maiat.

### Dual Token Architecture

| | MAIAT | Scarab |
|---|---|---|
| Purpose | Payment, staking, governance | Behavior incentive, feature access |
| Tradeable | ✅ | ❌ |
| Supply | Market-driven | Maiat-controlled |

### Earn (Quality-Driven)

| Action | Reward |
|---|---|
| First wallet connect | 10 Scarab (one-time) |
| Review marked "helpful" | 5 Scarab |
| Review gets agent response | 10 Scarab |
| Correct prediction bet | Variable |
| Review accuracy bonus (monthly) | 5-30 Scarab |
| SDK integration goes live | 500 Scarab |

### Spend (Burn)

| Action | Cost |
|---|---|
| Agent Risk Alert access | 10 Scarab |
| Prediction market bet | 1-50 Scarab |
| Agent ranking vote | 5 Scarab |
| Trust Alert subscription | 20 Scarab/month |
| Agent deep analysis | 3 Scarab |

### Identity Tiers

| Lifetime Earned | Title | Min Stake |
|---|---|---|
| 100+ | Scout | — |
| 500+ | Sentinel | — |
| 2,000+ | Oracle | — |
| 5,000+ | Guardian | — |

### Three-Phase Rollout

| Phase | Scope |
|---|---|
| Phase 1 (Day 1-30) | Off-chain, core loop (predict, review, alerts) |
| Phase 2 (Day 31-60) | Bounty board, leaderboard, farm detection |
| Phase 3 (Q3 2026) | On-chain migration (metrics-gated: MAU >500, earn/burn 1.2-1.8x) |

---

## 9. Roadmap

### Phase 1 (Day 1-30) — Live Product + Revenue

- Everything in Section 5 ✅
- Free API endpoint `/api/v1/trust` (Day 7-14)
- EAS data flywheel Phase 1 on Sepolia
- Agent self-service offerings (Day 15-30)
- Scarab core loop (off-chain)

### Phase 2 (Day 31-60) — Scale + DeFi Integration

- TrustGateHook activation on Base
- EAS Phase 2 (oracle reads attestations)
- MaiatPassport SBT
- Agent Yelp features (boost, premium dashboard)
- 2-3 DeFi protocol integrations
- Multi-chain ACP indexing
- Scarab expansion (bounty board, leaderboard)

### Phase 3 (Q3 2026) — Cross-chain + Ecosystem

- Chainlink CRE cross-chain oracle
- SDK growth (Rig, Swarms, CrewAI, LangChain)
- Premium Data API (MAIAT)
- Scarab on-chain migration (if metrics met)

### Phase 4 (Q4 2026) — Beyond DeFi

- Non-DeFi agent trust scoring
- Agent-to-agent trust network
- ZKTLS exploration (if ecosystem ready)

---

## 10. GTM

### Channels

1. **Free API → ACP Conversion** — 100/month free, excess → paid ACP
2. **SDK Adoption → Official Merge** — ElizaOS first, then GAME, then AgentKit
3. **ACP Monopoly** — Only trust service on Virtuals ACP
4. **Hook Demonstration** — Every gated pool = passive query volume
5. **B2B Agent Operators** (Day 60-90) — $5-$20/month plans
6. **Passport Network Effect** — SBT cross-platform distribution

### 60-Day Execution Plan (3/11 - 5/10)

| Week | Action |
|---|---|
| 1-2 | Trust Exposé thread + Prediction Market launch + Free API |
| 3-4 | Risk Alerts + Profile titles + First buyback |
| 5-6 | Agent self-service + ElizaOS PR + Month 1 report |
| 7-8 | Hook pool activation + Scarab Leaderboard + 60 Days Report |

### Revenue Projections

| Scenario | Monthly Queries | Monthly Revenue | Monthly Buyback |
|---|---|---|---|
| Day 30 | 200-500 | ~$10-50 | ~$3-15 |
| Day 90 | 2,000-5,000 | ~$100-300 | ~$30-90 |
| Day 180 | 10,000-30,000 | ~$500-2,000 | ~$150-600 |
| Day 365 | 50,000-150,000 | ~$3,000-10,000 | ~$900-3,000 |

---

## 11. Business Model

### Revenue Streams

**Demand side (paid ACP):** $0.01-$0.10/query + 0.15% swap
**Supply side (Agent Yelp):** Claim $0.02, Certify $0.20, Analytics $0.03, Boost $0.05/day
**B2B (Day 60+):** $5-$20/month plans
**Protocol (Phase 2+):** Hook fees, Passport mint, Premium API

**Monthly burn rate: <$100** — Extremely capital efficient.

---

## 12. Competitive Moat

1. **Data Moat** — 2,292 agents scored, compounding daily
2. **Integration Moat** — 7 SDKs, oracle address lock-in
3. **Cryptographic Moat** — EAS attestations reference our resolver
4. **Network Effect** — More agents → better oracle → more integrations

---

## 13. Team

**JhiNResH — Founder** | [@JhiNResH](https://x.com/JhiNResH) | [github.com/JhiNResH](https://github.com/JhiNResH)

5 iterations over 2+ years. Full-stack + Solidity + security. AI-augmented development with 4 specialized agents.

---

## 14. Risk Factors

| Risk | Severity | Mitigation |
|---|---|---|
| Trust score gaming | Critical | Rolling window, anomaly detection, community reviews, blacklist |
| Low query volume | High | Free API tier, SDK default-on |
| Smart contract vuln | Critical | 139 Foundry tests, Owner/Operator separation |
| Solo founder | Medium | Open source, verified contracts, comprehensive docs |
| Competitor | Medium | Data depth moat — starts at zero vs 2,292 |

---

## 15. Links

- **Web App:** [app.maiat.io](https://app.maiat.io)
- **API Docs:** [app.maiat.io/docs](https://app.maiat.io/docs)
- **GitHub:** [github.com/JhiNResH/maiat-protocol](https://github.com/JhiNResH/maiat-protocol)
- **ACP Agent:** #18281 on [app.virtuals.io/acp](https://app.virtuals.io/acp)
- **Twitter:** [@0xmaiat](https://x.com/0xmaiat) | [@JhiNResH](https://x.com/JhiNResH)
- **Dune:** [dune.com/jhinresh/maiat-trust-infrastructure-base](https://dune.com/jhinresh/maiat-trust-infrastructure-base)
- **ClawHub:** `clawhub install maiat-trust-api`
- **Base Builder Code:** bc_cozhkj23

---

## 16. Technical Specs

### 16.1 Oracle Sync + Auto-Attest

**Goal:** auto-attest cron 定期把 DB trust scores 寫到鏈上

**Inputs:**
- QueryLog 中未 attest 的記錄（buyer-target pair 24h 去重）
- EAS Schema UIDs:
  - TrustScore: `0xaeabc9...e57a`
  - Review: `0x5f7c21...0488`
  - ACPInteraction: `0x8b9f32...16d2`
- Deployer wallet: `0x046aB9D6...`
- TrustScoreOracle: `0xf662902...` (Base Sepolia)

**Acceptance Criteria:**
- [ ] auto-attest cron uses `EAS_DEPLOYER_KEY`
- [ ] Attests unattested QueryLog entries (24h dedup)
- [ ] Calls `TrustScoreOracle.updateScore()` after batch
- [ ] Logs tx hash + UID back to DB
- [ ] Max 20 attestations per run (gas budget)

### 16.2 ScarabToken.sol

**Goal:** Scarab 積分上鏈，默認不可轉讓（SBT-like），admin 可開放

**Design:**
- ERC-20 (OpenZeppelin) with `transferable` bool (default: false)
- `transferWhitelist` mapping
- `mint/burn` — only owner
- `_update()` override enforces transfer gate
- Deploy to Base Sepolia via `EAS_DEPLOYER_KEY`

**Acceptance Criteria:**
- [ ] Transfer blocked when `transferable == false`
- [ ] `setTransferable(true)` enables free transfer
- [ ] Whitelist management works
- [ ] Only owner can mint/burn
- [ ] Verified on BaseScan
- [ ] batch-settle cron: DB balance → on-chain delta → mint/burn

### 16.3 Reputation ↔ Staking Linkage (Phase 2)

**Goal:** 連動 reputation、staking、review 三個系統

**Current State:**
- `user.reputationScore` 從未被 update
- 1 🪲 = 1 票，不管 reputation 多高

**Phase 2 Changes:**

1. **Review → Reputation**: write +5, upvote +2, downvote -1 (min 0)
2. **Staking → Reputation**: 每質押 100 🪲 → +1 (daily snapshot)
3. **Reputation → Staking 權重**: new 1x, trusted 1.25x, verified 1.5x, guardian 2x
4. **Review → Staking 加成**: 評論過的 project +10% weight, UI "Reviewed ✓" badge

**Acceptance Criteria:**
- [ ] 寫 review 後 reputationScore 增加
- [ ] Upvote 後 reviewer reputationScore 增加
- [ ] Market standings 按 effective stake 排序
- [ ] Passport 顯示 effective vs raw stake

**Timeline:** Wadjet Phase B 之後

### 16.4 Token Forensics (Day 30-60)

**Planned:**
- Deep contract analysis (honeypot, ownership, liquidity locks)
- Holder concentration scoring
- Trading pattern anomaly detection
- `/api/v1/token/{address}/forensics` endpoint

---

_Last updated: 2026-03-09_
_Previous specs merged: `2026-03-07-maiat-virtuals-60days.md`, `2026-03-08-oracle-sync-scarab-token.md`, `2026-03-09-reputation-staking-linkage.md`_

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

**Solution:** Maiat is the autonomous trust layer for agentic commerce — three products that protect before, during, and after every agent transaction:

1. **Guard SDK** (`@maiat/viem-guard` v0.2.0) — Wallet-level protection for every tx. Anti-poisoning, trust checks, threat reporting, collective immunity. Distributed via SKILL.md — agents auto-learn to install it.
2. **TrustGateHook** (Uniswap V4) — Dynamic swap fees based on reputation. Guardian (200+ rep) = 0% fee, New (0-9) = 0.5%.
3. **Maiat Evaluator** (ERC-8183) — Quality verification for agent-to-agent jobs. Maiat serves as the Evaluator in the Virtuals + EF standard.

**What's already live:** 6 mainnet contracts (MaiatOracle, TrustGateHook, ERC-8004 Identity/Reputation, MaiatPassport, ScarabToken) · Guard SDK v0.2.0 on npm · 4 ACP offerings collecting fees · 35K+ agents scored · Threat reporting endpoint (collective immunity) · Oracle sync cron (DB → on-chain) · Outcome metadata enrichment (swap data → Wadjet ML) · skill.md v2.1 (ERC-8183 + Guard docs) · Wadjet ML engine (XGBoost V2, 98% accuracy) · MCP server · 7 SDK packages · EAS data flywheel · Dune Analytics dashboard

**Three-layer protection:**

```
Pre-tx:   Guard checks counterparty trust → blocks bad actors
During:   Hook enforces dynamic fees → rewards good reputation
Post-tx:  Evaluator verifies quality → writes to ERC-8004 → updates scores
```

**Token:** MAIAT via Virtuals Unicorn. 45% LP, 25% Automated Capital Formation, 25% Team (1yr lock + 6mo vest), 5% Airdrop. Revenue from ACP queries → 30% buyback MAIAT from Day 1.

**Why now:** Agent population exploding, ERC-8183 (Agentic Commerce) just launched (March 10, 2026 — Virtuals + EF co-authored), infrastructure (EAS, Uniswap v4 Hooks, Chainlink CRE) ready. First mover wins the data moat.

**Ask:** Launch MAIAT on Virtuals. 60 days to prove: query volume growth, Guard adoption, protocol integrations, transparent buybacks.

---

## 2. Day 1 User Experience

When a user opens app.maiat.io on launch day:

**Homepage hero:**

> _17,437 AI agents. Which ones can you trust?_
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

| Prediction                                            | Settles | Why It's Engaging                                  |
| ----------------------------------------------------- | ------- | -------------------------------------------------- |
| "MAIAT reaches 500 holders in 7 days"                 | Day 7   | Self-fulfilling prophecy — holders want to push it |
| "Agent #X maintains >70 trust score for 30 days"      | Day 30  | Meta-game testing oracle accuracy                  |
| "Next ACP rug happens within 14 days"                 | Day 14  | Fear-driven engagement                             |
| "Maiat gets integrated by 1 DeFi protocol in 30 days" | Day 30  | Team accountability                                |
| "ACP adds >1,000 new agents in 30 days"               | Day 30  | Ecosystem sentiment indicator                      |

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

Maiat is the autonomous trust layer for agentic commerce. Three products that work independently but compound together:

```
Guard (wallet layer)     — protects ALL transactions, any agent, any protocol
  ├── Anti-poisoning     — vanity match + dust liveness detection
  ├── Trust check        — Maiat API query before every tx
  ├── HookData injection — auto-detect TrustGateHook pools, inject signed scores
  ├── Threat reporting   — collective immunity (3+ reports → auto-flag)
  └── Outcome recording  — swap metadata feeds Wadjet ML

Hook (pool layer)        — dynamic fees on Uniswap V4 pools with TrustGateHook
  ├── Guardian (200+)    → 0% fee
  ├── Verified (50+)     → 0.1% fee
  ├── Trusted (10+)      → 0.3% fee
  └── New (0-9)          → 0.5% fee

Evaluator (ERC-8183)     — quality verification for agent-to-agent jobs
  ├── Pre-job            — Guard checks Provider trust
  ├── Post-job           — Maiat attests deliverable quality on-chain
  └── Feedback           — writes to ERC-8004 → updates TrustScore → loop
```

**Distribution strategy:** SKILL.md → agents auto-learn to install Guard → data flywheel → better scores → LP demand for Hook pools → more volume → moat.

**One-liner:** ZachXBT says "99% of AI agents in crypto is a scam." Maiat is how the 1% prove they're not.

**Evolution:** EatNGo → SmartReviewHub → Recivo → TruCritic → Ma'at → Maiat — 6 iterations, each one teaching us what trust infrastructure actually needs.

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

| Contract                 | Address              | Purpose                                        |
| ------------------------ | -------------------- | ---------------------------------------------- |
| **MaiatOracle**          | `0xc6cf...6da`       | On-chain trust scores — `getTrustScore()`      |
| **MaiatReceiptResolver** | `0xda69...1c0`       | EAS guardian — rejects non-Maiat attestations  |
| **TrustGateHook**        | `0xf980...aFf`       | Uniswap v4 Hook — gates swaps via `beforeSwap` |
| **EAS Schema**           | `0x24b0...d802`      | Maiat Receipt attestation schema               |
| **ERC-8004 Identity**    | `0x8004A169FB4a...`  | Identity registry on Base mainnet              |
| **ERC-8004 Reputation**  | `0x8004BAa17C55a...` | Reputation feedback on Base mainnet            |

### Maiat Trust Hook Suite (Uniswap v4)

| Hook              | Callback                                       | Function                                      | Status                     |
| ----------------- | ---------------------------------------------- | --------------------------------------------- | -------------------------- |
| **TrustGateHook** | `beforeSwap`                                   | Binary gate — block swaps below threshold     | ✅ Deployed (Base Sepolia) |
| **TrustFeeHook**  | `beforeSwap` + `afterSwap`                     | Dynamic fees + reputation mining              | 🔜 Hookathon (3/19)        |
| **TrustLPGuard**  | `beforeAddLiquidity` + `beforeRemoveLiquidity` | LP rug protection — lock period for low-trust | 🔜 Hookathon (3/19)        |

**Hook Strategy: Infrastructure, Not Application** — Any pool creator on Uniswap v4 can attach hooks. Maiat earns from oracle queries, not swap fees.

### Launch Strategy: Route A — Virtuals Launch + Self-Built v4 Dogfood Pool

| Phase   | Action                                                   |
| ------- | -------------------------------------------------------- |
| Day 1   | MAIAT launches on Virtuals Unicorn (V2 pool)             |
| Day 30  | Deploy TrustFeeHook to Base mainnet + MAIAT/WETH v4 pool |
| Day 30+ | Bankr API-level trust check integration                  |
| Day 60+ | Non-Virtuals projects adopt hooks permissionlessly       |
| Day 90+ | Pitch Virtuals on v4 graduation support                  |

**Honest constraint:** Virtuals graduation migrates to Uniswap V2, not V4. Cannot add hooks to Virtuals pools. Self-built v4 pool is dogfood + demo.

### ACP Offerings (Live on Railway)

| Offering           | Fee    | Description                                       |
| ------------------ | ------ | ------------------------------------------------- |
| `agent_trust`      | $0.02  | Verify agent before hiring — trustScore, verdict, completionRate, paymentRate |
| `token_check`      | $0.01  | ERC-20 safety check before swap — honeypot, highTax, riskFlags |
| `token_forensics`  | $0.05  | Deep rug analysis — Wadjet ML (60%) + heuristics (40%), contract/holder/liquidity breakdown |
| `agent_profile`    | $0.03  | Behavioral trends, diversity score, wash trading detection, Wadjet risk signals |

**Agent Self-Service (Planned Day 15-30):**

| Offering          | Fee       | Status    |
| ----------------- | --------- | --------- |
| `agent_claim`     | $0.02     | 🔜 Day 15 |
| `agent_certify`   | $0.20     | 🔜 Day 20 |
| `agent_analytics` | $0.03     | 🔜 Day 25 |
| `agent_boost`     | $0.05/day | 🔜 Day 30 |

### Passport + ENS Identity (NEW — 2026-03-13)

| Component | Status | Details |
| --------- | ------ | ------- |
| **maiat.eth** | ✅ Registered | L1 Ethereum, 3yr (expires 2029-03-13), owner `0x9584...6c06` |
| **NameStone CCIP-Read** | ✅ Live | Resolver `0xA873...5125`, zero-gas subdomains |
| **test.maiat.eth** | ✅ Verified | First subdomain, resolves correctly |
| **Passport DB** | ✅ Deployed | `passports` table in Supabase, 5 unique identity anchors |
| **POST /passport/register** | ✅ Live | Idempotent, creates ENS subdomain + passport |
| **GET /passport/lookup** | ✅ Live | Universal lookup by ensName, wallet, clientId, or acpAgentId |
| **Auto-create middleware** | ✅ Live | Any API call with X-Maiat-Client → upsert Passport |

**Architecture:**
```
maiat.eth (L1) → CCIP-Read (NameStone) → API → zero gas subdomains
Agent API call → auto-create Passport + ENS subdomain
ENS name = Passport = ERC-8004 identity (three-in-one)
```

**Identity Unification:** One agent can have 5 IDs (X-Maiat-Client, wallet, ACP ID, Virtuals ID, ERC-8004 ID). Passport is the unified anchor — any ID maps to the same Passport.

### Web App (app.maiat.io)

| Page                  | Function                               |
| --------------------- | -------------------------------------- |
| `/explore`            | Browse 2,292+ agents with trust scores |
| `/agent/[name]`       | Agent detail with behavioral insights  |
| `/review/[address]`   | On-chain review with weighted scoring  |
| `/swap`               | Trust-gated swap UI                    |
| `/markets`            | AI agent prediction markets            |
| `/leaderboard`        | Top agents by trust score              |
| `/passport`           | ENS-style search + register            |
| `/passport/[name]`    | Passport detail — trust, stats, identity |
| `/passport/[address]` | Trust Passport — wallet reputation     |
| `/analytics`          | Protocol analytics dashboard           |
| `/docs`               | API reference, SDK guides              |

### Guard SDK — Wallet Protection Layer (NEW in v0.2.0)

**Package:** `@maiat/viem-guard` (npm) — [GitHub](https://github.com/JhiNResH/maiat-guard)

| Module                     | Function                                              |
| -------------------------- | ----------------------------------------------------- |
| `createMaiatAgentWallet()` | One-line setup — wraps any EIP-1193 provider          |
| `withMaiatTrust()`         | Viem middleware — intercepts every tx                 |
| `antiPoisonGate()`         | Vanity match (first4+last4) + dust liveness detection |
| `fetchSignedScore()`       | EIP-712 signed scores for TrustGateHook               |
| `encodeSwapHookData()`     | ABI-encode hookData for Uniswap V4                    |
| `reportThreat()`           | Privacy-safe threat reporting → collective immunity   |

**Closed-loop integration:**

```
Guard intercepts tx → checkTrust (Maiat API)
  → If TrustGateHook pool → auto-inject hookData → fee discount
  → Tx result → POST /api/v1/outcome (with swap metadata)
  → Wadjet recomputes scores → Oracle Sync → on-chain update
  → Guard reads new scores next time → loop
```

**Threat reporting:** `POST /api/v1/threat/report` — 3+ independent reports on same address → trustScore auto-set to 0. All Guard-protected agents instantly block it.

### ERC-8183 Evaluator — Agentic Commerce Layer (NEW)

ERC-8183 (co-developed by Virtuals Protocol + Ethereum Foundation dAI team, March 10, 2026) defines trustless agent-to-agent commerce:

- Job primitive: Client → Provider → **Evaluator** → Settlement
- Escrow contract with state machine: Open → Funded → Submitted → Terminal

**Maiat as Evaluator:**

- Historical trust scores (not one-shot judgment)
- Wadjet ML risk prediction
- EAS attestation on evaluation result
- Writes to ERC-8004 → composable reputation

**ERC-8183 Resources:**

- Spec: https://eips.ethereum.org/EIPS/eip-8183
- Discussion: ethereum-magicians.org/t/erc-8183-agentic-commerce/27902
- Builder community: https://t.me/erc8183

### SDK Ecosystem (8 npm packages)

| Package                       | Framework         |
| ----------------------------- | ----------------- |
| `maiat-sdk`                   | Core              |
| `@maiat/viem-guard`           | Viem (Guard v0.2) |
| `@jhinresh/mcp-server`        | MCP               |
| `@jhinresh/elizaos-plugin`    | ElizaOS           |
| `@jhinresh/agentkit-plugin`   | Coinbase AgentKit |
| `@jhinresh/game-maiat-plugin` | GAME SDK          |
| `@jhinresh/virtuals-plugin`   | Virtuals GAME     |
| (planned) `@maiat/evaluator`  | ERC-8183          |

### Automated Infrastructure

| Cron Job          | Schedule        | Purpose                                 |
| ----------------- | --------------- | --------------------------------------- |
| `index-agents`    | Daily 02:00 UTC | Index new agents from ACP               |
| `auto-attest`     | Daily 03:00 UTC | EAS attestations for ACP interactions   |
| `oracle-sync`     | Daily 04:00 UTC | Sync trust scores to on-chain oracle    |
| `resolve-markets` | Daily 00:00 UTC | Settle prediction markets past closesAt |

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

| Phase | Source                                                         | Status                                   |
| ----- | -------------------------------------------------------------- | ---------------------------------------- |
| A     | Virtuals ACP REST API (5min polling, 17K+ agents)              | ✅ Live                                  |
| A     | Virtuals Protocol API (24hr sync, 20K+ agents)                 | ✅ Live                                  |
| A     | Base mainnet events (EAS + ERC-8004)                           | ✅ Live                                  |
| B     | DexScreener price tracking (15min, 100+ tokens)                | ✅ Live                                  |
| C     | Health signals engine (completion trend, LP drain, volatility) | ✅ Live                                  |
| D     | Rug prediction MVP (rule-based, 8 signals)                     | ✅ Live                                  |
| D+    | GoPlus Security API                                            | Planned (SSL issue)                      |
| E     | XGBoost ML model                                               | Planned (needs 3+ months price history)  |
| F     | Monte Carlo simulation                                         | Planned (needs sufficient snapshot data) |

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

### Phase 1: NOW → 3/19 (Hookathon Deadline) 🔥

- [x] Guard SDK v0.2.0 — wallet protection for every agent tx
- [x] Guard → SKILL.md distribution
- [x] 閉環: threat/report + oracle sync + outcome metadata
- [x] MCP server ready
- [x] Uniswap V4 TrustGateHook on testnet
- [x] Maiat Passport + ENS — agent.maiat.eth identity, auto-create on API call
- [x] Passport register + lookup API endpoints
- [x] Auto-create middleware (any API call → upsert Passport)
- [ ] **MaiatACPHook.sol (ERC-8183)** — 6 lifecycle hooks, deploy to Base 🔥 THIS WEEK
- [ ] **TrustFeeHook** — dynamic fees + reputation mining 🔥 Hookathon
- [ ] Auto-attest on ACP offerings
- [ ] Free API endpoint /api/v1/trust — the distribution hook
- [ ] EAS data flywheel

### Phase 2: 3/20 → 4/15 (Token Launch Sprint)

- [ ] Passport claim flow — wallet signature + mandatory tweet → Scarab rewards
- [ ] passport.maiat.io — independent subdomain, ENS-style UI
- [ ] Agent claim page + "Maiat Certified" badge — supply-side revenue starts
- [ ] Pump.fun Base integration — token_check for agent tokens on Base
- [ ] Guard SDK for Pump.fun trading bots
- [ ] Hook demo: 建 2-3 個真實 token pair 池子（USDC/WETH）
- [ ] MAIAT token launch on Virtuals
- [ ] First buyback execution
- [ ] ElizaOS or GAME SDK PR — default-on trust checks

### Phase 3: 4/15 → 6/15 (Multi-Chain + Growth)

- [ ] TrustGateHook live on Base mainnet
- [ ] Hook Factory — 一鍵建 TrustGated 池子
- [ ] Pump.fun Agent Trust Feed — embed Maiat scores
- [ ] **Solana expansion** — port MaiatOracle, token_check for Solana mints
- [ ] `@maiat/solana-guard` SDK
- [ ] Guard RPC Proxy (rpc.maiat.xyz)
- [ ] SDK growth (Rig, Swarms, CrewAI, LangChain)
- [ ] 60 Days transparency report
- [ ] Scarab leaderboard + bounty board

### Phase 4: Q3 (Scale)

- [ ] **BNB Chain expansion** — clone Base contracts, Wadjet BNB training data
- [ ] Hook 生態: 10+ pools actively using TrustGateHook
- [ ] Hook Revenue: protocol fee from dynamic fee spread
- [ ] Chainlink CRE cross-chain oracle
- [ ] Premium Data API (MAIAT-gated)
- [ ] Reputation staking
- [ ] Agent Yelp premium — boost, analytics, verified profiles

### Phase 5: Q4+ (Moat)

- [ ] ZKML — verifiable trust computation
- [ ] Hook as DeFi standard — protocols gate liquidity natively
- [ ] Multi-chain Hook deployment (Arbitrum, Optimism, Monad)
- [ ] Agentic Commerce Data Layer — default trust check for all agent-to-agent transactions

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

1. **Three-layer moat** — Guard + Hook + Evaluator = only system protecting before, during, AND after transactions
2. **Data Moat** — 35K+ agents scored, compounding daily via Guard outcome data
3. **Distribution Moat** — SKILL.md auto-adoption = zero BD cost, viral growth
4. **Integration Moat** — 8 SDKs, oracle address lock-in, ERC-8004 + ERC-8183
5. **Cryptographic Moat** — EAS attestations reference our resolver
6. **Network Effect** — More Guard users → better scores → more Hook pools → more data → moat

### Competitive Landscape

| Competitor | What they do | What we do differently |
|------------|-------------|----------------------|
| UFX (@Regu1ar_J0e) | Generic ERC-8183 hooks | Evaluator with ML + historical memory + Guard |
| Intuition | Knowledge graph (static) | Dynamic scoring + real-time wallet protection |
| Ethos | Single credit score | Multi-dimensional + on-chain execution (Hook) |
| Kredo AI | Agent rep data (closed) | Open API + Guard SDK + Hook enforcement |

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

### 16.5 Passport + ENS Identity System (NEW — 2026-03-13)

**Goal:** Unified agent identity — one API call → ENS name + Passport + trust score + Scarab

**Architecture:**
```
maiat.eth (L1 Ethereum)
  → Resolver: NameStone CCIP-Read (0xA873...5125)
  → agent.maiat.eth → NameStone DB → returns address + text records
  → Any ENS-compatible app resolves (MetaMask, Rainbow, ENS app)
```

**Passport DB Schema:**
```
Passport {
  id, clientId, walletAddress, ownerAddress, acpAgentId,
  erc8004Id, ensName, name, description,
  type ("agent" | "human"), status ("unclaimed" | "claimed" | "active"),
  trustScore (default 30), scarabBalance (default 10),
  totalQueries, totalOutcomes, streakDays, lastActiveAt,
  referralCode, referredBy, claimTweetUrl, claimedAt, avatarUrl
}
```

**ENS Text Records (per subdomain):**
```
agent.maiat.eth:
  addr(60)        → 0xAgent...            // Base wallet
  text("type")    → "agent"               // agent | human
  text("api")     → "https://app.maiat.io/api/v1/passport/agent"
  text("8004.id") → "42"                  // ERC-8004 agentId
  text("acp.id")  → "18281"              // Virtuals ACP ID
```

**Three Registration Channels:**
1. **API auto-create** — Any API call with `X-Maiat-Client` → upsert Passport (non-blocking middleware)
2. **KYA human registration** — Connect wallet on app.maiat.io/passport → manual register
3. **Proactive** — Build passports for all 14,600+ indexed agents (CoinGecko-style)

**Scarab Economics:**
- Earn: first API call (10🪲), claim (50🪲), 8004 register (50🪲), reportOutcome (2🪲), 7-day streak (20🪲), referral (25🪲)
- Sink: premium ENS (500🪲), rename (100🪲), customize passport (50🪲), boost (50🪲/week), forensics credits (200🪲), SBT badge (500🪲)

**Referral System:** 25🪲 per referral + 10% of referee's outcomes for 30 days. Anti-abuse: per-agent once, 500🪲/month cap, same-owner agents excluded.

**Claim Flow:** Tweet is MANDATORY. No tweet = no claim = no 🪲. Estimated 1,800 tweets = 900K impressions free marketing.

**Acceptance Criteria:**
- [x] POST /passport/register → returns ensName + Passport
- [x] name.maiat.eth resolves in ENS app / MetaMask
- [x] Any API call + X-Maiat-Client → auto-create Passport + ENS
- [ ] Passport frontend (passport.maiat.io) — ENS-style search + register
- [ ] Claim flow — wallet signature + mandatory tweet
- [ ] ERC-8004 integration — register → +50🪲

### 16.6 Multi-Chain Expansion — Pump.fun Agentic Economy (NEW — 2026-03-13)

**Context:** Pump.fun ($1B+ revenue) is expanding to Base, BNB Chain, Monad, Ethereum. They announced "Automated Buybacks for Tokenized Agents" — agents have their own tokens, performance → automatic buyback → token appreciation.

**Maiat Positioning:**
```
Pump.fun = Agent Tokenization (agent has token)
Maiat    = Agent Trust (is agent trustworthy?)

Pump.fun asks: "Which agent deserves to be tokenized?"
Maiat answers: trustScore + verdict + Wadjet ML
```

**Integration Opportunities:**

| Opportunity | Description | Priority |
|-------------|-------------|----------|
| Token Trust API | Pump.fun agent token → Maiat token_check → rug risk | 🔥 Phase 1 |
| Guard SDK for bots | Query Maiat before buying Pump.fun agent tokens | Phase 1 |
| Agent Trust Feed | Pump.fun embeds Maiat trust badge/score | Phase 2 |
| TrustGateHook on pools | Hook into Pump.fun pools on Base | Phase 2 |

**Multi-Chain Readiness:**

| Chain | Pump.fun Status | Maiat Readiness | Action |
|-------|----------------|-----------------|--------|
| **Base** | Launching | ✅ Oracle + Hook deployed | Direct integration |
| **Solana** | Home base | ❌ Not deployed | Phase 2: Deploy Solana program |
| **BNB Chain** | Preparing | ❌ Not deployed | Phase 3: EVM clone |
| **Ethereum L1** | Preparing | ✅ Has 8004 | Need Hook |
| **Monad** | Preparing | ❌ Not deployed | Phase 3+: Watch |

**Solana Expansion Plan (Phase 2):**
1. Wadjet ML supports Solana token analysis (partial data exists)
2. Solana program — port MaiatOracle logic
3. token_check API supports Solana mint addresses
4. Guard SDK for Solana (`@maiat/solana-guard`)

**BNB Chain Expansion (Phase 3):**
1. Clone Base contracts to BNB Chain (EVM compatible)
2. Wadjet adds BNB Chain token training data
3. token_check API supports BNB addresses

**Strategy:** Prove value on Base first → expand to Solana (Pump.fun's home) → then BNB/others.

### 16.7 ERC-8183 — MaiatEvaluator + MaiatACPHook (🔥 Phase 1 Priority)

> Merged from `2026-03-12-maiat-evaluator.md`. Updated 2026-03-14.

**Goal:** 兩個合約組成一個系統 — Evaluator 做裁判，ACPHook 攔截 6 個 lifecycle actions。

#### 閉環飛輪

```
Guard 擋壞人 → ACP 鎖錢 → Hook 攔截 → Evaluator 裁判
  → EAS 存證 → 8004 更新 → Wadjet 學習
  → Oracle 同步 → Hook 調費率 → Guard 更準 → 循環
```

**一句話：** 每個 agent-to-agent 交易，Maiat 在交易前（Hook）、交易中（Evaluator）、交易後（EAS+8004）全程介入。

#### 兩個合約

| 合約 | 角色 | 介入時機 |
|------|------|---------|
| **MaiatACPHook** | IACPHook — lifecycle 攔截 | `beforeAction` / `afterAction` |
| **MaiatEvaluator** | 裁判 — complete/reject | Job submitted 後 |

#### MaiatACPHook — 6 Lifecycle Hooks

```solidity
interface IACPHook {
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external returns (bool);
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}
```

| Action | beforeAction | afterAction |
|--------|-------------|-------------|
| `setProvider` | 查 provider trust → 低分 revert | — |
| `setBudget` | 根據 trust 調整額度上限 | — |
| `fund` | 查 client trust → 防惡意 client | — |
| `submit` | 驗證 provider 未被 flagged | — |
| `complete` | — | 寫 EAS attestation + ERC-8004 reputation +1 |
| `reject` | — | 記錄失敗，ERC-8004 reputation -1 |
| `claimRefund` | ❌ 不 hook（安全考量） | ❌ |

**beforeAction 邏輯：**
```
beforeAction(jobId, selector, data):
  provider = decode(data)
  score = MaiatOracle.getTrustScore(provider)
  threats = threatReports[provider]

  if selector == setProvider:
    require(score >= providerThreshold, "LOW_TRUST")
    require(threats < threatThreshold, "FLAGGED")
  
  if selector == setBudget:
    maxBudget = score >= 80 ? unlimited : score >= 50 ? 1 ETH : 0.1 ETH
    require(budget <= maxBudget, "BUDGET_EXCEEDS_TRUST")

  if selector == fund:
    clientScore = MaiatOracle.getTrustScore(client)
    require(clientScore >= clientThreshold, "UNTRUSTED_CLIENT")

  if selector == submit:
    require(threats < threatThreshold, "PROVIDER_FLAGGED")
  
  return true
```

**afterAction 邏輯：**
```
afterAction(jobId, selector, data):
  if selector == complete:
    → EAS.attest(provider, score, "COMPLETED", jobId)
    → ERC8004Reputation.addFeedback(provider, true)
    → emit JobCompleted(jobId, provider, score)

  if selector == reject:
    → ERC8004Reputation.addFeedback(provider, false)
    → emit JobRejected(jobId, provider, score, reason)
```

#### MaiatEvaluator — 裁判合約

```solidity
interface IMaiatEvaluator {
    function evaluate(address acpContract, uint256 jobId) external;
    function setThreshold(uint256 threshold) external;
    function setThreatThreshold(uint256 count) external;
    function preCheck(address provider) external view returns (uint256 score, bool wouldPass);
}
```

**evaluate() 邏輯：**
```
evaluate(acpContract, jobId):
  job = ACP.getJob(jobId)
  require(job.status == Submitted)
  require(job.evaluator == address(this))
  score = TrustScoreOracle.getScore(job.provider)
  threatCount = threatReports[job.provider]

  if threatCount >= threatThreshold → reject("FLAGGED_AGENT")
  if score >= threshold → complete(attestationHash)
  if score < threshold  → reject("LOW_TRUST_SCORE")

  emit EvaluationResult(jobId, provider, score, decision, reason)
```

#### TrustGateHook vs MaiatACPHook（完全分離）

| | TrustGateHook | MaiatACPHook |
|--|--------------|-------------|
| 標準 | Uniswap V4 | ERC-8183 |
| Callback | `beforeSwap` / `afterSwap` | `beforeAction` / `afterAction` |
| 場景 | DEX swap 費率 | Agent-to-agent job escrow |
| 共同點 | 都讀 MaiatOracle trust score | 同左 |

#### Maiat 在 8183 中的三個角色

| 角色 | 做什麼 | 已有 code |
|------|--------|----------|
| **Hook** | `beforeAction` 查 trust，低分擋交易 | ✅ TrustGateHook (需 adapt) |
| **Evaluator** | `complete/reject` 決定工作是否完成 | 🔜 MaiatEvaluator |
| **Attestor** | 交易完成後發 EAS + 寫 8004 reputation | ✅ auto-attest cron |

#### 自己吃自己的飯

| 角色 | 誰 | 說明 |
|------|-----|------|
| Client | 外部 Agent | 付 $0.01-0.05 買 Maiat 的 ACP offerings |
| Provider | Maiat (Agent #18281) | 提供 agent_trust / token_check / token_forensics / agent_reputation / trust_swap |
| Evaluator | MaiatEvaluator | 根據 TrustScore 裁判 Job 品質 |
| Hook | MaiatACPHook | 攔截 6 個 lifecycle actions |

#### 合約依賴

| 依賴 | 地址 | 網路 |
|------|------|------|
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` | Base Mainnet |
| TrustScoreOracle | `0xf662902ca227baba3a4d11a1bc58073e0b0d1139` | Base Sepolia |
| ERC-8004 Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | Base Mainnet |
| ERC-8004 Reputation | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | Base Mainnet |
| AgenticCommerce (ERC-8183) | TBD — Virtuals 部署 | — |

#### 配置參數

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `providerThreshold` | 30 | setProvider 最低分數 |
| `clientThreshold` | 20 | fund 最低 client 分數 |
| `threatThreshold` | 3 | 幾個 threat reports 自動 reject |
| `owner` | deployer (`0xB1e5...`) | admin |
| `oracle` | MaiatOracle | 分數來源 |

#### Events

```solidity
// MaiatACPHook
event ActionBlocked(uint256 indexed jobId, bytes4 selector, address actor, uint256 score, string reason);
event JobCompleted(uint256 indexed jobId, address indexed provider, uint256 score);
event JobRejected(uint256 indexed jobId, address indexed provider, uint256 score, bytes32 reason);

// MaiatEvaluator
event EvaluationResult(uint256 indexed jobId, address indexed provider, uint256 score, bool completed, bytes32 reason);
event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
event ThreatReported(address indexed provider, uint256 newCount);
```

#### 安全考量

1. **只有指定 Evaluator 能 complete/reject** — 合約地址必須是 Job 的 evaluator
2. **Oracle 數據新鮮度** — 每日同步，~24h 延遲；備案：EIP-712 signed scores
3. **Reentrancy** — complete/reject 轉帳 escrow，用 ReentrancyGuard
4. **Gas** — beforeAction ≈ 50-80k gas，evaluate() ≈ 150-200k gas
5. **Fail-safe** — oracle 沒分數 → 預設 score = 0 → reject
6. **claimRefund 不 hook** — 安全考量，不應該攔退款

#### 測試計劃

**MaiatACPHook (`test/MaiatACPHook.t.sol`):**
- [ ] beforeAction(setProvider) — score >= threshold → pass
- [ ] beforeAction(setProvider) — score < threshold → revert
- [ ] beforeAction(setProvider) — flagged → revert
- [ ] beforeAction(setBudget) — budget capped by trust tier
- [ ] beforeAction(fund) — client score check
- [ ] beforeAction(submit) — flagged provider → revert
- [ ] afterAction(complete) — EAS attestation + 8004 reputation +1
- [ ] afterAction(reject) — 8004 reputation -1

**MaiatEvaluator (`test/MaiatEvaluator.t.sol`):**
- [ ] evaluate() — score >= threshold → complete
- [ ] evaluate() — score < threshold → reject
- [ ] evaluate() — 3+ threats → auto-reject
- [ ] evaluate() — job not Submitted → revert
- [ ] evaluate() — evaluator != this → revert
- [ ] preCheck() — correct score + wouldPass
- [ ] setThreshold() — owner only

**Fuzz Tests:**
- [ ] fuzz_beforeAction_thresholdBoundary(uint256 score, uint256 threshold)
- [ ] fuzz_evaluate_threatCount(uint256 threats, uint256 threatThreshold)

**Deploy:**
- [ ] Base Sepolia: MaiatACPHook + MaiatEvaluator
- [ ] Verify on BaseScan
- [ ] Wire to existing MaiatOracle

#### Acceptance Criteria

- [ ] `forge build` 通過
- [ ] `forge test` 全部通過（unit + fuzz）
- [ ] MaiatACPHook: 6 lifecycle hooks 正確攔截
- [ ] MaiatEvaluator: complete/reject 邏輯正確
- [ ] beforeAction revert 有 clear error message
- [ ] afterAction 寫 EAS + 8004
- [ ] 部署到 Base Sepolia
- [ ] Hookathon 提交前完成 (3/19 deadline)

#### Future Hooks（Phase 3+ — 有需求再做）

- LendingTrustHook — 借貸協議信任門檻
- BridgeTrustHook — 跨鏈橋信任檢查
- NFTMarketHook — NFT 交易信任
- DelegationHook — 委託信任

---

_Last updated: 2026-03-14_
_Previous specs merged: `2026-03-07-maiat-virtuals-60days.md`, `2026-03-08-oracle-sync-scarab-token.md`, `2026-03-09-reputation-staking-linkage.md`, `2026-03-12-maiat-guard-2.0.md`, `2026-03-12-maiat-close-the-loop.md`, `2026-03-12-maiat-evaluator.md`_
```

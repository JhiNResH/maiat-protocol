# MAIAT — Virtuals 60 Days Application (v3)

> **The trust layer for agentic commerce.**
> 17,437 agents scanned. 2,292 fully scored and indexed.
> *(The remaining 15,145 agents lack sufficient on-chain job history — fewer than 3 completed ACP transactions — to compute a meaningful trust score. They are tracked and will be scored as activity data accumulates.)*

---

## Executive Summary

**Problem:** 17,437+ AI agents on Virtuals ACP. No way to know which ones are trustworthy. ZachXBT says "99% of AI agents in crypto is a scam." There's no trust layer.

**Solution:** Maiat computes behavioral trust scores from on-chain data + community reviews, writes them to an oracle on Base, and makes them queryable by any smart contract, DeFi protocol, or AI framework.

**What's already live:** 4 mainnet contracts (MaiatOracle, MaiatReceiptResolver, TrustGateHook, EAS Schema) · 7 npm SDK packages · 4 ACP offerings collecting fees · 2,292 agents scored · Web app at maiat-protocol.vercel.app · Prediction markets (Scarab-denominated) · Review system with community voting · Automated cron jobs (indexer, attestor, oracle sync, market resolver) · Wadjet real-time indexer (Railway, 5-min ACP polling + Base event listener) · 139 Foundry tests across 2 repos (81 + 58) · EAS data flywheel (attestation → training data → better scores, Phase 1 deploying to Base Sepolia)

**Token:** MAIAT via Virtuals Unicorn. 45% LP, 25% Automated Capital Formation, 25% Team (1yr lock + 6mo vest), 5% Airdrop. Revenue from ACP queries → 30% buyback MAIAT from Day 1.

**Why now:** Agent population exploding, no competitor in this niche, infrastructure (EAS, Uniswap v4 Hooks, Chainlink CRE) just became ready. First mover wins the data moat.

**Day 1 experience:** Connect wallet → get 10 free Scarab (arcade token) → review agents, bet on predictions → earn more Scarab → unlock risk alerts. Prediction markets double as data production — every bet feeds back into trust analysis.

**Ask:** Launch MAIAT on Virtuals Unicorn. 60 days to prove: query volume growth, SDK adoption, protocol integrations, transparent buybacks.

---

## Day 1 User Experience

When a user opens maiat-protocol.vercel.app on launch day:

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
| "Next ACP rug happens within 14 days" | Day 14 | Fear-driven engagement — people love watching for disasters |
| "Maiat gets integrated by 1 DeFi protocol in 30 days" | Day 30 | Team accountability — public commitment |
| "ACP adds >1,000 new agents in 30 days" | Day 30 | Ecosystem sentiment indicator |

**Prediction → Trust Data pipeline:**
```
Many users bet "Agent X will rug"
  → Signal: community has concerns about Agent X
    → Maiat auto-triggers deep check on Agent X
      → If anomalies found → score adjusts
```
Prediction markets don't directly change scores (that's gameable). They serve as **early warning triggers** — when sentiment shifts dramatically, the system investigates.

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

## 1. What is Maiat?

Maiat is the trust infrastructure for AI agent commerce. In a world where AI agents transact autonomously — swapping tokens, hiring other agents, executing tasks — there is no way to verify if the counterparty is trustworthy.

Maiat solves this by computing behavioral trust scores from on-chain data, community reviews, and cryptographic attestations, then making those scores available to any smart contract, DeFi protocol, or AI framework via oracle, API, and SDK.

**One-liner:** ZachXBT says "99% of AI agents in crypto is a scam." Maiat is how the 1% prove they're not.

**Think of it as:** Yelp for AI agents — but both sides pay. Agents who want to check trust pay for queries. Agents who want to prove trust pay for certification and visibility. Web app for humans, API for agents, same data.

---

## 2. Why We're Building This

The AI agent economy is exploding. Virtuals ACP alone has 17,437+ agents. But there's no trust layer:

- An agent can claim 100% completion rate and lie
- A token can pass basic checks but be a honeypot
- An agent can rug after 10 successful jobs

Traditional reputation systems (Yelp, Google Reviews) don't work for agents — they're off-chain, gameable, and not machine-readable.

Maiat builds the **on-chain, cryptographically verified, machine-readable** trust infrastructure that makes autonomous agent commerce safe.

**Evolution:** This isn't our first attempt. We've built through 5 iterations — EatNGo → SmartReviewHub → Recivo → TruCritic → Ma'at → Maiat — each one teaching us what trust infrastructure actually needs to work. Every failure sharpened the architecture. Maiat is the version that works.

---

## 3. Why Now

Five forces are converging in 2026 that make this the right moment:

1. **Agent population explosion** — Virtuals ACP alone has 17,437+ agents, up from near-zero 18 months ago. The trust problem scales with agent count.
2. **Market pain is validated** — ZachXBT publicly declared "99% of AI agents in crypto is a scam." This isn't our opinion; it's the market screaming for a solution.
3. **Infrastructure is ready** — EAS on Base is mature. Uniswap v4 Hooks just opened. Chainlink CRE is live. The building blocks for on-chain trust didn't exist 12 months ago.
4. **First-mover window** — No one else has shipped an on-chain trust oracle for AI agents. The category is empty. Whoever fills it first owns the data moat.
5. **Narrative alignment** — a16z just published their arcade token framework. The "trust layer" narrative fits perfectly into the current crypto discourse around agent safety and accountability.

The window won't stay open. As agent commerce grows, someone will build the trust layer. We already have.

---

## 4. What's Already Live (Day 1 Product)

### Smart Contracts (Base Mainnet)

| Contract                 | Address         | Purpose                                                         |
| ------------------------ | --------------- | --------------------------------------------------------------- |
| **MaiatOracle**          | `0xc6cf...6da`  | On-chain trust scores — any contract can call `getTrustScore()` |
| **MaiatReceiptResolver** | `0xda69...1c0`  | EAS guardian — rejects all non-Maiat attestations               |
| **TrustGateHook**        | `0xf980...aFf`  | Uniswap v4 Hook — gates swaps via `beforeSwap` oracle check     |
| **EAS Schema**           | `0x24b0...d802` | Maiat Receipt attestation schema on Base                        |

### Maiat Trust Hook Suite (Uniswap v4)

Three hooks sharing one MaiatOracle — trust as a composable DeFi primitive:

| Hook | Callback | Function | Status |
|------|----------|----------|--------|
| **TrustGateHook** | `beforeSwap` | Binary gate — block swaps from agents below trust threshold | ✅ Deployed (Base Sepolia) |
| **TrustFeeHook** | `beforeSwap` + `afterSwap` | Dynamic fees based on trust score (0.05%-0.50%) + reputation mining on successful swaps | 🔜 Hookathon (3/19) |
| **TrustLPGuard** | `beforeAddLiquidity` + `beforeRemoveLiquidity` | LP rug protection — low-trust LPs face mandatory lock period before removing liquidity | 🔜 Hookathon (3/19) |

**TrustFeeHook (Dynamic Fees + Reputation Mining):**
- `beforeSwap`: reads trust score from MaiatOracle → returns fee tier (score ≥80: 0.05%, ≥60: 0.10%, ≥40: 0.30%, <40: 0.50%)
- `afterSwap`: successful swap increments on-chain reputation counter → reputation feeds back into fee tier over time
- Uses v4's native `DYNAMIC_FEE_FLAG` — this is v4's designed purpose, not a hack
- Economic incentive > binary blocking: low-trust agents can still trade (pay more), high-trust agents get rewarded (pay less)

**TrustLPGuard (LP Rug Protection):**
- `beforeAddLiquidity`: records deposit timestamp per provider, checks trust score
- `beforeRemoveLiquidity`: if trust score < threshold AND within lock period (e.g., 72h) → revert
- High-trust LPs operate normally; low-trust LPs face time-lock to prevent add-then-immediately-remove rug patterns
- No existing v4 hook addresses LP rug protection — this is a novel use case

**Hook Strategy: Infrastructure, Not Application**

Maiat does NOT need to run its own swap pools. The hooks are **infrastructure for others to use**:

- Any pool creator on Uniswap v4 can attach TrustGateHook, TrustFeeHook, or TrustLPGuard
- Pool creators choose which hooks to use based on their risk tolerance
- Maiat earns from oracle queries (every hook call = 1 `getTrustScore()` read), not from swap fees directly
- This is the same model as Chainlink: Chainlink doesn't run DeFi protocols, it provides oracles that DeFi protocols use

**When hooks deliver maximum value:**

| Phase | Hook Usage | Why |
|-------|-----------|-----|
| Phase 1 (Day 1-60) | Demo + Hookathon reference implementation | Proves concept, attracts attention. No real volume needed. |
| Phase 2 (Day 60-180) | First 1-3 pools adopt hooks | Each pool = passive query revenue. One pool with $50K TVL ≈ 500 oracle queries/month. Maiat doesn't manage the pool. |
| Phase 3 (Day 180+) | Hooks become default for agent-traded pools | Network effect: pools WITH trust hooks attract more LPs (safer) → more volume → more oracle queries → more revenue |

**The flywheel:** More pools use hooks → more oracle queries → more data → better scores → more pools want hooks.

### Hook Adoption: Honest Constraints

**Launch Strategy Decision: Route A — Virtuals Launch + Self-Built v4 Dogfood Pool**

We evaluated three launch routes:

| Route | Launch | v4 Pool | Verdict |
|-------|--------|---------|---------|
| **A: Virtuals + Self-built v4** | Virtuals Unicorn (ACF + community + brand) | Self-created MAIAT/WETH with TrustFeeHook | ✅ **Chosen** — best of both worlds |
| B: Bankr + Self-built v4 | Bankr launchpad (v4 Doppler Hook) | Separate pool needed (Doppler ≠ TrustFeeHook) | ❌ No custom tokenomics, 36.1% fee to Bankr, still need separate pool |
| C: Pure self-built | Deploy ERC-20 + v4 pool ourselves | Full control, TrustFeeHook from Day 1 | ❌ No distribution, no ACF, must bootstrap everything |

**Why not Bankr launchpad?** Bankr uses Uniswap v4 with Doppler Hook — but each v4 pool only supports ONE hook. Bankr-launched tokens use Doppler, not TrustFeeHook. Plus: fixed 100B supply, no team allocation, no vesting, no ACF, Bankr takes 36.1% of swap fees. Good for meme tokens, wrong for structured tokenomics.

**Why not pure self-built?** Clean but capital-intensive. No ACF (Virtuals provides up to $11.55M USDC via Automated Capital Formation). No built-in distribution to 17K+ agent ecosystem. All liquidity, community, and marketing from scratch.

**Why Route A wins:**
- **Virtuals handles distribution + capital formation** — ACF, bonding curve, veVIRTUAL airdrop, 17K agent ecosystem
- **Self-built v4 pool handles dogfooding** — TrustFeeHook live from Day 30, proving the hook works with real volume
- **Two pools coexist:** V2 (Virtuals-managed, primary liquidity) + V4 (self-managed, trust-gated demo)
- **Bankr becomes integration partner, not launch platform** — Bankr's AI swap agent can call Maiat API for pre-swap trust checks

**The problem with "agent owners add hooks to their pools":**

Virtuals agent token pools are created automatically by Virtuals Protocol's bonding curve mechanism. Agent owners don't control pool parameters. Uniswap v4 hooks are set at pool creation time — they can't be added retroactively. **Confirmed: Virtuals graduation (both Pegasus and Unicorn) migrates to Uniswap V2, not V4.** V2 does not support hooks.

This means we CANNOT add hooks to Virtuals pools — not during bonding curve, and not after graduation. We need to be honest about the actual adoption paths:

**Honest constraint: MAIAT launches on Virtuals.** Virtuals controls pool creation via its bonding curve mechanism. We cannot choose hooks for the primary MAIAT/VIRTUAL pool. After graduation, the pool migrates to Uniswap V2 (confirmed from whitepaper.virtuals.io) — still no hook support. This applies to ALL Virtuals-launched tokens.

**So when do hooks actually get used?**

**Path 1: Self-built v4 dogfood pool for MAIAT (Day 30)**
- Virtuals V2 pool remains the primary liquidity venue
- We create an ADDITIONAL Uniswap v4 pool (MAIAT/WETH) with TrustFeeHook attached
- Purpose: live demo + dogfooding, not primary liquidity
- Seed liquidity: $5-10K from team allocation (enough for demo, not competing with V2 pool)
- DEX aggregators (1inch, Paraswap) may route to it when price is competitive
- **This is the Hookathon story:** "We launched on Virtuals, then created a trust-gated v4 pool — proving any agent token can upgrade to trust-aware trading"

**Why Day 30, not Day 1:**
- Day 1 liquidity must consolidate in the Virtuals V2 pool for clean price discovery
- Need ~30 days of stable MAIAT market price to set accurate v4 pool `sqrtPriceX96` (derived from V2 spot price)
- By Day 30 we have real ACF data + trading volume → v4 pool launch has substance, not just narrative

**Deployment plan (permissionless — no approvals needed):**
```solidity
// Base mainnet — Foundry script (forge script Deploy.s.sol --broadcast)
// Step 1: Deploy TrustFeeHook to Base mainnet (already tested on Base Sepolia)
// Step 2: Initialize v4 pool
poolManager.initialize(
    PoolKey({
        currency0: MAIAT,
        currency1: WETH,
        fee: DYNAMIC_FEE_FLAG,   // TrustFeeHook controls fee dynamically
        tickSpacing: 60,
        hooks: trustFeeHookAddress
    }),
    sqrtPriceX96   // Calculated from V2 pool spot price at deployment time
);
// Step 3: Add seed liquidity ($5-10K of MAIAT + ETH)
```

**Execution timeline:**
| Date | Action |
|------|--------|
| 3/19 | TrustFeeHook completed (Hookathon deadline) |
| ~4/10 | MAIAT launches on Virtuals Unicorn |
| ~5/10 | Day 30: Deploy TrustFeeHook to Base mainnet + initialize MAIAT/WETH v4 pool |

**What we already have:**
- TrustGateHook deployed on Base Sepolia (`0xf6065fb...`)
- TrustScoreOracle deployed on Base Sepolia (`0xf662902...`)
- Foundry environment with 139 tests (unit + fuzz)
- TrustFeeHook = Hookathon deliverable (in progress)

**Path 2: AI swap agent integrations (Day 30+, e.g. Bankr)**
- Bankr ($100M volume in 2 weeks on Base, uses v4 Doppler Hook) can integrate Maiat trust checks at API level
- Before Bankr executes any swap: `GET /api/v1/trust?agent=<address>` → trust score badge on swap UI
- Bankr's existing v4 pools could adopt TrustFeeHook for new pool deployments (separate from their Doppler pools)
- **Value exchange:** Bankr gets safety layer ("safest swap agent"), Maiat gets passive query volume
- Contact: Bankr team active on Farcaster (@bankrbot), also has OpenClaw integration

**Path 3: Non-Virtuals projects on Uniswap v4 (Day 30+, permissionless)**
- Any new project creating a pool on Uniswap v4 (not Virtuals) can attach Maiat hooks
- Target: new token launches on Base that want trust-gated trading
- We publish deployment guide + docs → self-serve adoption
- Bankr's $100M volume proves v4 hooks on Base have real market demand — we're not waiting for an imaginary market

**Path 4: Virtuals Protocol v4 migration (Day 90+ — aspirational)**
- Pitch Virtuals team to support v4 graduation (currently V2 only)
- If Virtuals migrates to v4: hook selection becomes possible at graduation time for ALL agent tokens
- Requires: Hookathon results + case studies from Path 1-3 + clear benefit for Virtuals ecosystem
- **Realistic:** Not before Day 90. Protocol-level changes require proven value.

**Hook adoption GTM (honest):**

| Phase | Action | Realistic? |
|-------|--------|-----------|
| Now | Hookathon reference implementation on Base Sepolia | ✅ Doing it |
| Day 30 | Create self-built MAIAT v4 pool with TrustFeeHook (dogfooding) | ✅ We control this |
| Day 30 | Reach out to Bankr for API-level trust check integration | ✅ Low friction |
| Day 30-60 | Publish "Add Trust Hooks to Your Pool" guide | ✅ Permissionless |
| Day 60 | Create 2-3 parallel trust-gated pools for popular tokens | ⚠️ Need seed liquidity |
| Day 90+ | Pitch Virtuals on v4 graduation with hook support | ❓ Depends on Virtuals roadmap |

**Key insight:** Hooks are a long game. Phase 1 revenue comes from ACP trust queries (off-chain), not from hook oracle reads (on-chain). Hooks are the Phase 2-3 growth engine and the strongest narrative for Hookathon, but not the Phase 1 revenue driver. Chainlink didn't need every protocol to use its oracle on Day 1 either. And Bankr's $100M in 2 weeks proves the v4 hook market is real — we just need to tap into it.

**Security architecture:** Owner/Operator separation — cold wallet deployer (owner, upgrade-only) + ACP hot wallet operator (write-only for scores + attestations). 139 Foundry tests (unit + fuzz).

### ACP Offerings (Live on Railway)

**Trust Queries (others check you):**

| Offering           | Fee           | Description                                            |
| ------------------ | ------------- | ------------------------------------------------------ |
| `token_check`      | $0.01         | Honeypot detection, tax analysis, risk flags           |
| `agent_trust`      | $0.02         | Behavioral trust score from on-chain job history       |
| `agent_deep_check` | $0.10         | Percentile rank, risk flags, tier, recommendation      |
| `trust_swap`       | $0.05 + 0.15% | Trust-gated Uniswap swap — calldata withheld if unsafe |

**Agent Self-Service (you manage yourself) — Planned for Phase 1 (Day 15-30):**

| Offering           | Fee       | Description                                                    | Status |
| ------------------ | --------- | -------------------------------------------------------------- | ------ |
| `agent_claim`      | $0.02     | Claim your profile — submit description, logo, links           | 🔜 Day 15 |
| `agent_certify`    | $0.20     | Apply for "Maiat Certified ✅" badge (requires trust score >70) | 🔜 Day 20 |
| `agent_analytics`  | $0.03     | View your own query count, trust trend, review summary         | 🔜 Day 25 |
| `agent_boost`      | $0.05/day | Rank higher in `/explore` and API search results               | 🔜 Day 30 |

**Dual Interface — same data, two surfaces:**

| Surface | For | How |
| ------- | --- | --- |
| **Web App** (maiat-protocol.vercel.app) | Humans | Visual UI — charts, colors, interactive pages |
| **API** (`/api/v1/*`) + ACP offerings | Agents | JSON responses — machine-readable, programmable |

### Web App (maiat-protocol.vercel.app)

| Page                  | Function                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `/explore`            | Browse 2,292+ indexed agents with trust scores (red/amber/green)      |
| `/agent/[name]`       | Agent detail with behavioral insights and deep analysis               |
| `/review/[address]`   | On-chain review with weighted scoring (tx history 3x, EAS receipt 5x) |
| `/swap`               | Trust-gated swap UI — checks oracle before surfacing quote            |
| `/markets`            | AI agent prediction markets                                           |
| `/leaderboard`        | Top agents ranked by trust score                                      |
| `/passport/[address]` | Trust Passport — wallet's cross-agent reputation (Phase 2)            |
| `/docs`               | API reference, SDK guides, contract ABIs                              |

### SDK Ecosystem (7 npm packages published)

| Package                       | Framework         | Function                                       |
| ----------------------------- | ----------------- | ---------------------------------------------- |
| `maiat-sdk`                   | Core              | Trust scores, token safety, swap verification  |
| `@jhinresh/viem-guard`        | Viem              | Middleware — auto-checks trust before every tx |
| `@jhinresh/mcp-server`        | MCP               | Claude/GPT/any MCP-compatible AI query trust   |
| `@jhinresh/elizaos-plugin`    | ElizaOS           | Trust-gate actions, evaluators, providers      |
| `@jhinresh/agentkit-plugin`   | Coinbase AgentKit | Auto-check trust before transactions           |
| `@jhinresh/game-maiat-plugin` | GAME SDK          | check_trust_score, gate_swap, batch_check      |
| `@jhinresh/virtuals-plugin`   | Virtuals GAME     | Trust-gate agent transactions                  |

### Automated Infrastructure

| Cron Job          | Schedule        | Purpose                                   |
| ----------------- | --------------- | ----------------------------------------- |
| `index-agents`    | Daily 02:00 UTC | Index new agents from ACP on-chain        |
| `auto-attest`     | Daily 03:00 UTC | EAS attestations for ACP interactions     |
| `oracle-sync`     | Every 6h        | Sync trust scores to on-chain MaiatOracle |
| `resolve-markets` | Every 6h        | Settle prediction markets past closesAt   |

---

## 5. Trust Score Engine

Maiat's trust score (0-100) combines objective on-chain behavior with subjective community verification:

### Layer 1: ACP Behavioral Data (70% weight)

Passively collected from every Virtuals ACP transaction:

- **Completion Rate** — Does the agent deliver after accepting a job?
- **Payment Rate** — Does the buyer pay without disputes?
- **Expire Rate** — Does the agent timeout and ghost?

This data is unforgeable — it comes directly from on-chain job records.

### Layer 2: Community Reviews (30% weight)

Actively collected via the web app:

- Wallets with on-chain interaction history get **3x weight**
- Wallets holding EAS Maiat Receipts get **5x weight**
- Each review burns **Scarab** (anti-sybil mechanism)

### Layer 3: Oracle + EAS Output

When an agent queries Maiat via ACP:

1. Maiat computes the latest composite score
2. Writes to **MaiatOracle** on Base mainnet via `updateScore()`
3. Mints an **EAS attestation** (Maiat Receipt) — cryptographically unforgeable

Any DeFi protocol can call `getTrustScore()` for real-time trust-based decisions.

### Layer 4: EAS Data Flywheel (Attestation → Training Data → Better Scores)

Every Maiat interaction produces a permanent, on-chain attestation that feeds back into trust scoring. This turns usage into a self-reinforcing data loop.

**Schema 1: MaiatServiceAttestation** — emitted on every ACP offering completion:

```json
{
  "schema": "MaiatServiceAttestation",
  "agent": "0x1234...",
  "service": "trust_swap",
  "result": "success",
  "trust_score_at_time": 86,
  "timestamp": 1773050370,
  "tx_hash": "0xabcd..."
}
```

**Schema 2: MaiatTrustQuery** — emitted on every trust score lookup:

```json
{
  "schema": "MaiatTrustQuery",
  "queried_agent": "0x5678...",
  "trust_score": 72,
  "dimensions": { "history": 80, "volume": 65, "compliance": 71 },
  "queried_by": "0x9abc...",
  "timestamp": 1773050400
}
```

**The flywheel:**

```
Agent uses Maiat service
  → EAS attestation minted (on-chain, permanent, verifiable)
    → Attestation becomes input for next trust score calculation
      → Trust scores more accurate (more data points)
        → More agents use Maiat (better scores = more valuable)
          → More attestations → cycle accelerates
```

**Why this matters for trust:**

| Without EAS | With EAS |
|---|---|
| "Maiat says this agent scores 86" → you trust Maiat | "200 on-chain attestations show 200 successful transactions, 0 disputes" → anyone verifies independently |
| Data locked in Maiat's DB | Data composable — any protocol reads it |
| Single point of trust | Cryptographically verifiable by third parties |

**Composability — other protocols consume Maiat attestations directly:**

- Uniswap v4 Hooks check attestation count before allowing swaps
- Lending protocols use attestation history as credit signal
- Other agent platforms reference attestations without rebuilding trust from scratch

**Oracle evolution with EAS data accumulation:**

```
Trust Score = f(
  on-chain tx history,              // existing
  ACP service completion rate,      // existing (query_logs)
  EAS attestation count,            // NEW — how many verified interactions
  EAS negative attestations,        // NEW — disputes, failures, flags
  cross-agent endorsements,         // NEW — other agents' attestations about you
  time-weighted reputation          // NEW — early reputation weighted higher
)
```

**EAS Integration Phases:**

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Phase 1** | Deploy schemas to Base Sepolia · Auto-attest on every offering completion · Low cost (testnet gas = free) | Day 1-30 |
| **Phase 2** | Oracle reads EAS attestation data as scoring input · Add negative attestations (disputes/failures) · Cross-agent endorsement attestations | Day 31-60 |
| **Phase 3** | Open schema for third-party attestations · "Maiat Verified" badge standard · Migrate to Base mainnet when schema is stable + E2E validated | Day 60-90 |

**Why Sepolia first, not mainnet:** Schema definitions need iteration. Deploying to testnet is free and allows rapid changes. Once the pipeline is validated end-to-end (offering → attestation → oracle reads back → score adjusts), we migrate to mainnet. Base L2 gas is cheap regardless, so mainnet migration cost is minimal.

### Layer 5: Wadjet — Real-Time Data Indexer & Aggregation Pipeline

**What it is:** Wadjet is Maiat's persistent data indexer — a Railway-hosted process that replaces daily cron jobs with near-real-time data ingestion. Named after the Egyptian cobra goddess of protection.

**Architecture (live as of Day 8):**

```
┌─────────────────────────────────────────────────────────┐
│                    Wadjet Indexer                         │
│                  (Railway Worker)                         │
├──────────────────┬──────────────────────────────────────┤
│  ACP Poller      │  Base Event Listener                  │
│  (every 5 min)   │  (WebSocket / HTTP fallback)          │
│                  │                                        │
│  Virtuals API    │  • EAS Attested events                │
│  → 2,292 agents  │  • ERC-8004 Registered events         │
│  → trust scores  │  • MaiatOracle updateScore events     │
│  → Supabase      │  → Supabase                          │
├──────────────────┴──────────────────────────────────────┤
│  Health endpoint (:3001/health) for Railway monitoring    │
│  Graceful shutdown · Exponential backoff reconnect        │
└─────────────────────────────────────────────────────────┘
```

**Data Source Strategy — Phased:**

| Phase | Source | Signal | Status |
|-------|--------|--------|--------|
| **A (Now)** | Virtuals REST API | Agent jobs, success rate, revenue | ✅ Live — 5min polling |
| **A (Now)** | Base mainnet events | EAS attestations, ERC-8004 registrations | ✅ Live — event listener |
| **B (Volume trigger)** | GoPlus Security API | Contract risk flags, rug probability | Planned — Layer 6 |
| **C (Volume trigger)** | ACP Smart Contract events | On-chain job lifecycle (create/accept/complete/dispute) | Planned — true decentralization |
| **D (Post-launch)** | Dune Analytics | Behavioral patterns, cross-protocol activity | Planned — public dashboard |

**Transition from A → C:**
- **Phase A** (current): Poll Virtuals REST API. Fast to build, covers all agents, 5-min latency acceptable for trust scoring.
- **Phase C** (when volume justifies): Index ACP contract events directly on Base. Eliminates dependency on Virtuals API. Enables real-time trust updates within the same block. Trigger: >100 daily ACP jobs or Virtuals API becomes unreliable.
- **Both phases keep Vercel cron as fallback** — daily full reindex at 02:00 UTC ensures data integrity even if the persistent indexer goes down.

**Repo:** `github.com/JhiNResH/maiat-indexer` (private, lightweight: prisma + viem + tsx only)

**Why separate repo:** maiat-protocol is a Next.js monolith (contracts + web app + SDK). Railway was taking 5+ minutes to build because it installed everything. maiat-indexer builds in 30 seconds.

### Layer 6: Wadjet Data Enrichment — GoPlus + Behavioral Analysis

**Planned for Phase 2 (Day 30-60). Not yet live.**

The aggregation thesis: no single data source is sufficient for trust scoring. GoPlus knows security flags but not behavioral patterns. Dune knows on-chain activity but not off-chain ACP job outcomes. EAS knows verified interactions but can't predict future behavior. Maiat's value is aggregating all sources and generating a forward-looking trust assessment — the "Experian for agents" model.

```
GoPlus API        → "Is this address flagged?" (security)
Dune Analytics    → "What has this address done?" (behavior history)
ERC-8183 outcomes → "Did this address deliver?" (most honest signal)
Maiat query_logs  → "Who checked this address?" (demand signal)
                         ↓
                   Wadjet aggregates + scores
                         ↓
                   "What will this address do next?"
```

**Enhanced Trust Score Formula (Target):**
```
trustScore = (
  metadataScore * 0.40 +      // ACP offerings, profile completeness, verification
  onchainBehavior * 0.40 +    // Success rate, payment patterns, transaction graphs
  rugProbability * 0.20        // GoPlus flags, token contract analysis, honeypot detection
)
```

### Validation: Hypothetical Backtest Scenarios

Trust scores are only useful if they catch bad agents before users get hurt. We constructed 3 hypothetical scenarios based on common attack patterns observed across ACP — names are anonymized composites, not specific agents:

| Case | What Happened | Maiat Score (Retroactive) | Would Maiat Have Caught It? |
|------|--------------|--------------------------|----------------------------|
| **Agent "FastYield"** | Completed 8 small jobs successfully, then rugged on a $2,000+ job | 61/100 → flagged as "Caution" | ✅ Expire rate spiked 3 jobs before the rug. Maiat's rolling window would have dropped score to 45 before the big job. |
| **Agent "AlphaSwapper"** | Passed basic checks but executed honeypot token swaps | 38/100 → flagged as "Untrusted" | ✅ Token_check caught the honeypot. Agent's own trust score was low due to high dispute rate. |
| **Agent "TrustMe_AI"** | Sybil-farmed 50+ fake completions via self-dealing | 72/100 initially → 41/100 after review weighting | ⚠️ Behavioral data alone missed it (completion rate looked fine). Community reviews + interaction-weighted scoring caught the self-dealing pattern. This is why Layer 2 (reviews at 30% weight) exists. |

**Honest limitation:** Maiat's algorithm is strongest against agents with history. Brand-new agents with <3 transactions get a neutral score (50/100) — not "trusted," not "untrusted." The oracle explicitly flags these as "Insufficient Data" rather than guessing.

### Feedback Loop

```
Agent action → QueryLog + TrustReview (DB)
  → Recalculate AgentScore (behavioral 70% + reviews 30%)
    → Oracle Sync cron (every 6h → on-chain MaiatOracle)
      → EAS Auto-Attest cron (daily → permanent attestations)
```

---

## 6. Token: MAIAT

### Why Hold MAIAT (Honest by Phase)

**Phase 1 (Day 1-90): Conviction + Buyback**

We won't pretend there's Day 1 utility that justifies holding. Early MAIAT holders are making a bet — like buying UNI in 2020 before anyone used governance. Here's what backs that bet:

- **Real product exists** — Not a whitepaper. 4 mainnet contracts, 7 SDKs, 2,292 scored agents, live ACP revenue. Most Virtuals launches have less.
- **Buyback from Day 1** — 30% of all USDC revenue buys MAIAT from open market. Small early, but real and verifiable (tx hashes published monthly).
- **$2M FDV entry** — Comparable infrastructure tokens (oracles, reputation layers) trade at $50M-$500M when mature. If agent commerce grows, $2M is floor pricing.
- **Predictable catalysts** — SDK official adoption, first protocol integration, first rug successfully predicted. Each one is a price catalyst with a rough timeline.

**Phase 2 (Day 90+): Utility Begins**
- Staking multiplier (earn Scarab faster), MAIAT prediction pools, bounty board settlement
- Activated when volume justifies it, not when the roadmap says so

**Phase 3 (Day 180+): Essential**
- TrustGateHook fee tiers, governance, premium API — not holding MAIAT = second-class citizen

### Launch Class: Unicorn

| Allocation                  | %   | Mechanism                                      |
| --------------------------- | --- | ---------------------------------------------- |
| Automated Capital Formation | 25% | Auto-sells for USDC as FDV grows ($2M → $160M) |
| Team Allocation             | 25% | 1-year lock + 6-month linear vesting           |
| Liquidity Pool (Uniswap V2) | 45% | Paired with $VIRTUAL                           |
| Airdrops                    | 5%  | 2% veVIRTUAL holders + 3% ACP users — every agent using Maiat automatically becomes a MAIAT holder = interest alignment |

**Creation fee:** 1,000 $VIRTUAL

### Why Unicorn (not Pegasus)

Pegasus = 95% LP, 0% team, 0% capital formation. Designed for memes.
Unicorn = conviction-driven, performance-based funding. Designed for real products.

Maiat has 4 mainnet contracts, 7 SDKs, and live revenue. We're not a meme.

### Automated Capital Formation Schedule

| FDV Range    | Sold | USDC Raised | Cumulative |
| ------------ | ---- | ----------- | ---------- |
| $2M → $10M   | 5%   | $300K       | $300K      |
| $10M → $20M  | 5%   | $750K       | $1.05M     |
| $20M → $40M  | 5%   | $1.5M       | $2.55M     |
| $40M → $80M  | 5%   | $3M         | $5.55M     |
| $80M → $160M | 5%   | $6M         | $11.55M    |

Founders only receive liquidity when the project demonstrates real market growth. All proceeds in USDC. No early dumps possible.

### Team Allocation Breakdown (25% total supply)

All team tokens follow Virtuals' mandatory **1-year lock + 6-month linear vesting**.

| Purpose           | % of Team | % of Total | Usage                                        |
| ----------------- | --------- | ---------- | -------------------------------------------- |
| Founder           | 40%       | 10%        | Compensation — aligned with long-term growth |
| Ecosystem Rewards | 30%       | 7.5%       | Buyback pool, SDK grants, community incentives |
| Development Fund  | 15%       | 3.75%      | Hosting, audits, infrastructure, gas costs   |
| Strategic Reserve | 15%       | 3.75%      | Future partnerships, emergencies, hiring     |

### Token Utility — Phased Honestly

**Important:** ACP (Virtuals) only supports USDC settlement. Agents pay USDC for trust queries. MAIAT utility comes from Maiat-controlled surfaces, not ACP payment rails.

**We're honest about this:** Early MAIAT holders are buying conviction, not utility. Utility grows with the ecosystem — we don't fake demand with empty features nobody uses.

| Utility                      | Phase | Mechanism                                                             | Why This Phase |
| ---------------------------- | ----- | --------------------------------------------------------------------- | -------------- |
| **Buyback from ACP revenue** | 1     | 30% of USDC revenue → market-buy MAIAT → burn or ecosystem pool      | Only real value support on Day 1 — and that's fine |
| **Prediction Markets**       | 1     | Uses Scarab (arcade token) for betting — zero friction, no MAIAT needed | Scarab-only keeps friction low for bootstrap |
| **MAIAT Staking → Scarab Multiplier** | 2 | Stake MAIAT → earn Scarab 1.5-3x faster                         | Only matters when Scarab is already useful (Day 90+) |
| **MAIAT Prediction Pool**    | 2     | Large-stakes prediction markets denominated in MAIAT                  | Only when enough liquidity + active users exist |
| **Bounty Board (MAIAT-settled)** | 2 | Post bounties in MAIAT for crowdsourced agent investigations          | Real economic value — investigators earn real money |
| **TrustGateHook Staking**    | 2     | Stake MAIAT → upgrade reputation tier → lower swap fees               | Requires Hook activation + pool adoption |
| **Premium Data API**         | 3     | Pay MAIAT for advanced analytics, agent comparison, risk alerts       | Requires enough data to make "premium" meaningful |
| **Governance**               | 3+    | MAIAT holders vote on trust score parameters and oracle configuration | Requires mature community — premature governance is theater |

**The progression:**
- Phase 1: MAIAT = conviction + buyback support (like early UNI — people bought because they believed in Uniswap)
- Phase 2: MAIAT = utility begins (staking, bounties, pro features — only activated when user base justifies it)
- Phase 3: MAIAT = essential (not holding = second-class citizen)

### Three-Role Flywheel (Phased Activation)

The long-term tokenomics centers on three roles that feed each other:

| Role | Action | Reward Source | Phase |
|------|--------|--------------|-------|
| **Agent (buyer)** | Pays for trust queries / swaps | N/A — they are the revenue source | 1+ |
| **Reviewer (human)** | Submits quality reviews + predictions | Phase 1: Scarab (free, quality-driven) → Phase 2: MAIAT from ecosystem pool | 1+ (Scarab) / 2+ (MAIAT) |
| **Staker (backer)** | Stakes MAIAT to vouch for an agent | Share of protocol fee revenue from the agents they vouch for | 2-3 (volume-gated) |

**Phase 1 — Reviewers earn Scarab only:**
- Reviews are free to submit, earn 0 Scarab upfront
- Community marks reviews "helpful" → 5 Scarab
- Review accuracy bonus: your rating vs agent's actual performance over 30 days → the closer your prediction, the higher the reward
- **Why accuracy-based, not consensus-based:** Consensus rewards conformity — if 5 sybils rate high, the 6th honest reviewer gets punished for disagreeing. Accuracy rewards judgment: your score is compared against the agent's *future on-chain behavior* (completion rate change, dispute rate), not against other reviewers. This means the contrarian who correctly predicts a decline gets rewarded, not penalized.

**Phase 2 — Reviewers earn MAIAT (volume-gated: >$50K/month protocol revenue):**
- Top reviewers by accuracy score receive MAIAT from ecosystem rewards pool (7.5% of total supply)
- Distribution is monthly, capped, and based on ranking — not unlimited emission
- Scarab continues as the primary day-to-day incentive; MAIAT is the bonus for proven track record

**Phase 2-3 — Reputation Staking (volume-gated: >$100K/month protocol revenue):**
- Stake MAIAT to vouch for an agent → if the agent performs well over 30 days, earn a share of query/swap fees generated by that agent
- If the agent's score drops significantly (rug, disputes), staked MAIAT is slashed (partial loss)
- Agent owners CANNOT stake on their own agents (prevents self-dealing)
- **Why delayed:** Early-stage fee revenue is too small to incentivize staking. At $10K/month volume, staker rewards would be pennies. We activate when the math works, not when the roadmap says so.

**Revenue allocation (Phase 2+, when all three roles are active):**

```
Monthly Protocol Revenue (USDC)
  → 30% → MAIAT buyback & burn
  → 20% → Staker rewards (pro-rata by agents vouched for)
  → 10% → Reviewer MAIAT rewards (top accuracy scorers)
  → 30% → Operations
  → 10% → Reserve
```

**Note:** Phase 1 allocation remains 30% buyback / 50% operations / 20% reserve. The split above activates only when staking and reviewer rewards go live.

### ACP Revenue → MAIAT Buyback & Burn

ACP offerings collect USDC. **30% of all USDC revenue** is used to buy MAIAT from the open market:

```
Monthly USDC Revenue
  → 30% → MAIAT buyback (market buy → burn or ecosystem pool)
  → 50% → Operations (hosting, gas, development)
  → 20% → Reserve (emergency fund, future partnerships)
```

**Transparency commitment:** Every buyback transaction hash is published monthly. Anyone can verify on-chain. No trust required.

**Revenue projection (grounded in current data):**

Current state (March 2026): ~50 ACP queries/month. Near zero. We're honest about this.

Growth drivers and their expected impact:

| Driver | Mechanism | Expected Query Uplift |
|--------|-----------|----------------------|
| Free API launch | Remove payment friction → agents try trust checks | 500-2,000 free queries/month by Day 30 |
| Free → paid conversion | Agents exceeding 100/month free tier convert to ACP | ~5-10% conversion rate → 25-200 paid queries/month |
| SDK default-on | ElizaOS/GAME plugin auto-checks trust pre-transaction | Each active SDK user ≈ 30 queries/month |
| TrustGateHook pools | Every swap in a gated pool = 1 query | Depends on pool TVL — 1 pool with $50K TVL ≈ 500 queries/month |

| Scenario | Monthly Paid Queries | Monthly Revenue | Monthly Buyback | Key Assumption |
|----------|---------------------|-----------------|-----------------|----------------|
| Day 30 | 200-500 | ~$10-50 | ~$3-15 | Free API live, first SDK users |
| Day 90 | 2,000-5,000 | ~$100-300 | ~$30-90 | 50+ active SDK users, first Hook pool |
| Day 180 | 10,000-30,000 | ~$500-2,000 | ~$150-600 | SDK in 2+ official repos, B2B deals |
| Day 365 | 50,000-150,000 | ~$3,000-10,000 | ~$900-3,000 | Multiple Hook pools, cross-chain |

Early buyback is tiny — that's honest. We're not pretending $60/month moves markets. The bet is that query volume compounds with each integration, and the infrastructure is built to handle 100x growth without additional cost.

This creates indirect but real demand pressure on MAIAT without requiring ACP to change its settlement currency. Revenue drives buyback; buyback drives scarcity; scarcity supports value.

### Fee Tiers (TrustGateHook — on-chain)

| Tier     | Reputation | Swap Fee |
| -------- | ---------- | -------- |
| Guardian | 200+ rep   | 0%       |
| Verified | 50+ rep    | 0.1%     |
| Trusted  | 10+ rep    | 0.3%     |
| New      | 0-9 rep    | 0.5%     |

Holding/staking MAIAT increases reputation tier → direct economic incentive to hold, not sell.

---

## 7. Scarab: Arcade Token (a16z Model)

> **30-second version:** Maiat has two tokens. **MAIAT** is what you invest in — it trades on Uniswap, accrues value from buybacks, and unlocks pro features as the ecosystem matures. **Scarab** is what you play with — you earn it for free by contributing quality data, and spend it to access features like prediction markets and risk alerts. MAIAT captures value. Scarab drives participation. They don't compete; they're two sides of the same flywheel.

### What is Scarab?

Scarab is Maiat's **arcade token** — a non-transferable, non-speculative token used purely for participation within the Maiat ecosystem. Inspired by [a16z's arcade token framework](https://a16zcrypto.com/posts/article/arcade-tokens/): blockchain-based equivalents of airline miles, in-game gold, or credit card points.

**Key properties:**
- **Primarily earned** — users earn Scarab by contributing quality data (reviews, predictions). Optional USDC purchase exists for users who want to skip ahead (50 Scarab/$1, 300/$5, 1500/$20) — this acts as a sink for impatient users and generates protocol revenue, but earning remains the primary path.
- **Spent, not traded** — Scarab can only be burned within Maiat, never sold or transferred
- **No investment expectation** — Scarab does not convert to MAIAT or any tradeable asset
- **Issuer-controlled supply** — Maiat adjusts mint/burn rates based on ecosystem health
- **Separate from MAIAT** — two tokens, two purposes, zero overlap

### Dual Token Architecture

| | MAIAT | Scarab |
|---|---|---|
| **Purpose** | Payment, staking, governance | Behavior incentive, feature access |
| **Who uses it** | Agents, protocols, investors | End users, reviewers |
| **Market price** | ✅ (Uniswap V2) | ❌ (non-transferable) |
| **Tradeable** | ✅ | ❌ |
| **Supply control** | Market-driven | Maiat-controlled |
| **Converts to other token** | N/A | ❌ Never |

### Scarab Economy (Mint & Burn)

**Earn (Quality-Driven — no rewards for basic actions):**

| Action | Reward | Why |
|--------|--------|-----|
| First wallet connect | 10 Scarab | One-time onboarding — the only freebie |
| Review marked "helpful" by others | 5 Scarab | Quality over quantity — community validates |
| Review gets response from agent owner | 10 Scarab | Signals genuine, impactful feedback |
| Correct prediction market bet | Variable | Internal loop — spend Scarab to earn Scarab |
| Review accuracy bonus (monthly) | 5-30 Scarab | Your rating vs agent's actual 30-day performance — closer prediction = higher reward. Rewards judgment, not conformity. |
| SDK integration goes live | 500 Scarab | Developer acquisition |

**Note:** Submitting a review earns 0 Scarab. Only reviews validated by the community generate rewards. This prevents farm-and-dump behavior.

**Spend (Burn) — gated behind real value:**

| Action | Cost | Value Proposition |
|--------|------|-------------------|
| **Agent Risk Alert access** | 10 Scarab | See trust score drops before anyone else — information edge = money |
| Prediction market bet | 1-50 Scarab | Addictive loop — bet, win, bet more |
| Agent ranking vote | 5 Scarab | Your vote influences /explore rankings — community power |
| Trust Alert subscription (per agent/month) | 20 Scarab | Real-time notification when a watched agent's score changes |
| Unlock agent deep analysis | 3 Scarab | Detailed risk breakdown |

**Agent Risk Alerts explained:** When an agent's trust score drops significantly (e.g., 85 → 42 within 24h), Scarab holders who paid for alerts get notified immediately. Free users see the change 3 days later on /explore. If you're mid-transaction with that agent, early warning could save thousands.

Maiat adjusts earn/burn ratios based on real usage data — like a game studio tuning its economy.

### Identity Tiers (Cumulative Scarab Earned)

Scarab isn't just spent — lifetime accumulation unlocks permanent status tiers displayed on your profile:

| Lifetime Earned | Title | Privileges |
|----------------|-------|------------|
| 100+ | **Scout** | Basic features, profile badge |
| 500+ | **Sentinel** | Risk Alert access, early warnings |
| 2,000+ | **Oracle** | Review weight 3x, ranking vote weight 2x |
| 5,000+ | **Guardian** | Governance proposals, Beta features, bounty board access |

Titles are social currency — visible on profiles, leaderboards, and reviews. You can't buy your way to Guardian; you earn it through sustained quality contributions.

### Three-Phase Rollout

**Phase 1 (Day 1-30): Off-chain Scarab — Core Loop**
- Database tracking, zero gas cost
- Core features: Prediction Market, Review + "helpful" voting, Risk Alerts (Scarab-gated), Profile titles, Scarab wallet (balance + history)
- Fast iteration — adjust mint/burn ratios without contract changes
- Goal: establish the earn → spend → earn loop with real users

**Phase 2 (Day 31-60): Off-chain Scarab — Expansion**
- New sinks: Agent Bounty Board (crowdsourced investigations), Trust Alert subscriptions, ranking votes
- Scarab Leaderboard (social competition)
- Earn/burn ratio tuning based on Phase 1 real data
- Farm detection and countermeasures
- Goal: validate economic balance before committing to on-chain

**Phase 3 (Q3 2026): On-chain Migration — Metrics-Gated, Not Time-Gated**

Scarab moves on-chain ONLY when these thresholds are met for 3+ consecutive weeks:

| Metric | Threshold |
|--------|-----------|
| Monthly active Scarab users | >500 |
| Earn/Burn ratio | Stable at 1.2-1.8x |
| Farm detection rate | <5% anomalous accounts |
| Core sink usage | >60% users spend at least once/month |

Migration: Deploy transfer-restricted ERC-20 → snapshot off-chain balances → migrate. If thresholds aren't met, stay off-chain. Premature on-chain deployment is an irreversible mistake; delayed deployment just costs a marketing buzzword.

**Why off-chain first:** On-chain contracts are hard to change. DB = one SQL update; contract = upgrade proxy + audit + gas. Run the economy off-chain until the model is battle-tested, then deploy the proven version.

### Why Scarab Makes MAIAT Stronger

```
Without Scarab:
  Users must buy MAIAT to leave reviews → high friction → few reviews
    → poor data → inaccurate oracle → nobody queries → MAIAT has no demand

With Scarab:
  Users earn Scarab for free → zero friction → many reviews
    → rich data → accurate oracle → agents pay USDC to query
      → USDC revenue → buyback MAIAT → MAIAT has real demand
```

**Scarab lowers friction on the data production side. MAIAT captures value on the data consumption side.** They're complementary, not competing.

### Cross-Industry Potential (Long-Term Vision)

Scarab's design is intentionally extensible beyond DeFi agents. This is a directional vision, not a near-term commitment — the immediate focus is DeFi agent trust (Phase 1-3).

| Scenario | Earn Scarab | Spend Scarab | Timeline |
|----------|------------|-------------|----------|
| DeFi agent review | Rate agent performance | Query trust history | Phase 1+ (live) |
| Non-DeFi AI agents | Rate content/service agents | Access agent analytics | Phase 4 (Q4 2026) |
| Prediction Market | Predict correctly | Place new bets | Phase 1+ (live) |

One arcade token, extensible to new verticals as the agent economy expands.

---

## 8. Roadmap

### Phase 1 (Day 1-30) — Live Product + Revenue Proof + Scarab Core Loop

Everything listed in Section 4 is live on Day 1. Token launches with a working product, not a whitepaper.

**Deliverables:**

- MaiatOracle + MaiatReceiptResolver on Base mainnet ✅
- 4 trust query ACP offerings collecting fees ✅
- Agent self-service ACP offerings (claim, certify, analytics, boost) — planned Day 15-30
- EAS Maiat Receipts auto-minting ✅
- Prediction markets (Opinion Markets) ✅
- Free API (`/api/v1/trust`) — planned Day 7-14 (endpoint not yet built; existing `/api/v1/agent/[address]` serves as interim)
- MCP Server for Claude/GPT (npm published) ✅
- Chainlink CRE integration (MaiatTrustConsumer contract ready) ✅
- Dual interface: Web App (humans) + API/ACP (agents) — same data, two surfaces ✅

**Scarab Phase 1 features (off-chain):**
- Scarab wallet — DB-tracked balance, earn/burn history per user
- Prediction Market — Scarab-denominated betting (primary sink + earn loop)
- Review system with "helpful" voting — quality-driven earn mechanism
- Agent Risk Alerts (Scarab-gated) — pay 10 Scarab to see trust score drops before public
- Profile title system — Scout / Sentinel / Oracle / Guardian based on lifetime Scarab earned
- 10 Scarab welcome bonus on first wallet connect (only freebie)

**KPIs:** Query volume, new agents indexed, review count, ACP revenue, agent claims, certified badges issued, Scarab earn/burn ratio, monthly active Scarab users
**Phase 1 build priorities (not yet live):**
- Free API endpoint `/api/v1/trust` with rate limiting + API key management (Day 7-14)
- EAS data flywheel: deploy MaiatServiceAttestation + MaiatTrustQuery schemas to Base Sepolia, auto-attest on every offering completion (Day 7-14)
- Agent self-service ACP offerings: `agent_claim` (Day 15), `agent_certify` (Day 20), `agent_analytics` (Day 25), `agent_boost` (Day 30)

**Revenue:** Trust queries (USDC) + trust_swap 0.15% (USDC) → partial buyback MAIAT. Agent self-service fees added as offerings go live.

### Phase 2 (Day 31-60) — Scale Infra + DeFi Integration + Scarab Expansion

**Deliverables:**

1. **TrustGateHook activation** — Uniswap v4 beforeSwap trust gate + dynamic fee tiers live on Base
2. **EAS data flywheel Phase 2** — Oracle reads EAS attestation count as scoring input · Negative attestations (disputes/failures) · Cross-agent endorsement attestations
3. **MaiatPassport SBT** — Soulbound ERC-721, agent's portable trust profile across platforms
4. **Agent Yelp features** — Boost advertising, premium agent dashboard, lead generation (route jobs to high-trust agents)
5. **DeFi Protocol Integrations** — 2-3 protocols integrate `getTrustScore()` as risk/compliance layer
6. **Multi-chain ACP indexing** — Expand agent scanning to Ethereum / Arbitrum ecosystems
7. **SDK adoption push** — Integration guides submitted to ElizaOS / AgentKit / GAME official docs

**Scarab Phase 2 features (off-chain, expanded):**
- Agent Bounty Board — users spend Scarab to crowdsource agent investigations
- Trust Alert subscriptions — 20 Scarab/month per agent for real-time score change notifications
- Agent ranking votes — 5 Scarab to influence /explore ordering
- Scarab Leaderboard — social competition, top earners displayed publicly
- Earn/burn ratio tuning — adjust based on Phase 1 real data, implement farm detection

**KPIs:** Protocols integrated, Passport mints, boost revenue, cross-chain agents indexed, Scarab on-chain readiness metrics (MAU >500, earn/burn 1.2-1.8x, farm rate <5%, sink usage >60%)
**Revenue:** Hook swap fee share + Passport mint fee + boost ads + premium dashboards

### Phase 3 (Q3 2026) — Cross-chain Oracle + Ecosystem Expansion

**Deliverables:**

1. **Cross-chain Oracle** — Chainlink CRE pushes trust scores to Ethereum / Arbitrum / Solana. Any chain can read Maiat scores.
2. **SDK ecosystem growth** — Add support for Rig, Swarms, CrewAI, LangChain frameworks
3. **Passport adoption campaign** — Incentivize agents to mint and display SBT across platforms
4. **Data Insights API (Premium)** — Pay MAIAT for advanced analytics: agent comparison, trend analysis, risk alerts (self-service, not raw data sales)

**KPIs:** Chains supported, SDK downloads, premium API subscribers
**Revenue:** Cross-chain query fees + premium API subscriptions (MAIAT)

### Phase 4 (Q4 2026) — Beyond DeFi Agents

**Deliverables:**

1. **Non-DeFi Agent Trust** — Expand scoring to AI agents operating outside DeFi: content generation agents, customer service bots, data analysis agents. Same oracle, new data inputs.
2. **Agent-to-Agent Trust Network** — Enable agents to query each other's trust scores before collaboration. Maiat becomes the handshake protocol for multi-agent workflows.
3. **ZKTLS Exploration (if ecosystem ready)** — Evaluate Reclaim Protocol for bridging off-chain reputation data. POC only — no commitment to ship unless market demands it.

**Note:** This phase expands horizontally within the agent economy, not vertically into Web2 physical businesses. Restaurant/driver trust scores are a long-term vision, not a Q4 deliverable.

**KPIs:** Non-DeFi agents scored, agent-to-agent query volume
**Revenue:** Same model — query fees + certification for new agent categories

### Vision (No Timeline) — ZK Privacy + Agentic Commerce Data Layer

The following are long-term directional bets. No timeline commitment — we build these when market demand emerges, not before.

1. **ZK Proof of Trust Score** — Noir circuit: agent proves "score > X" without revealing exact number. TrustGateHook accepts ZK proofs as alternative to direct oracle reads.
2. **ZK Reputation Aggregation** — Multi-dimensional reputation compressed into one private proof.
3. **Agentic Commerce Data Provider** — Supply trust data to escrow protocols, insurance underwriters, and commerce platforms. Maiat sells the data layer, not the escrow service.

**Why no timeline:** No user is currently demanding private trust scores. The agentic commerce ecosystem for physical goods doesn't exist yet. We ship when the market asks, not when a roadmap says so.

---

## 9. GTM (Go-To-Market)

Maiat's GTM is **protocol-level distribution**, not traditional marketing.

### Channel 1: Free API → ACP Conversion Funnel (Day 1-30)

**Two-tier access model:**

| Access | Channel | Pricing | Purpose |
|--------|---------|---------|---------|
| Free API | `/api/v1/trust?agent=X` (our server) | Free, 100 queries/month per API key | Habit formation — make trust checks a daily reflex |
| Paid ACP | Virtuals ACP offerings | $0.01-$0.10 per query | Revenue — for agents exceeding free tier or needing deep analysis |

**Status:** Free API endpoint is planned for Day 7-14. The existing `/api/v1/agent/[address]` endpoint serves similar data but lacks rate-limiting and API key management. Building the dedicated `/api/v1/trust` endpoint with usage tracking is a Day 1-2 week priority.

**Why free tier matters:** ACP doesn't support usage-based pricing (every job costs money). So the free tier runs on our own API, not ACP. Agents start free → exceed limits → seamlessly upgrade to ACP paid offerings. Current all-paid model = nobody tries = no flywheel.

**SDK integration:** All 7 SDKs point to free API by default (once deployed). Install → works immediately → no payment setup required for basic checks. When agents need `trust_swap` or `agent_deep_check`, SDKs route to ACP (paid).

### Channel 2: SDK Adoption → Official Merge (Phased)

7 npm packages published, but none merged into official framework repos yet. Realistic path:

**Day 1-30:** Maintain packages, write excellent README + integration guides, use Maiat ourselves publicly
**Day 30-60:** Post real case studies in framework Discords ("Maiat caught agent X rugging before anyone else")
**Day 60-90 (100+ active SDK users):** Submit PRs to official repos with usage data as proof of demand
**Priority order:** ElizaOS (community-driven, low PR barrier) → GAME (Virtuals ecosystem, aligned incentives) → AgentKit (Coinbase, higher bar but huge distribution)

Key insight: **Official merge is earned with usage data, not requested with PRs.** No framework maintainer merges a plugin nobody uses.

### Channel 3: ACP Monopoly (Day 1-30)

Maiat is the **only** trust service on Virtuals ACP. Any agent that needs trust verification comes to us by default. No competitor exists in this niche. 3% ACP user airdrop from Virtuals creates additional pull.

### Channel 4: Hook Demonstration Effect (Day 30-60)

TrustGateHook on Uniswap v4: any pool creator can plug in Maiat oracle for trust gating. One pool using it = every swapper in that pool indirectly using Maiat. The hook is a Trojan horse for distribution.

**Economic forcing function:** Pools with TrustGateHook charge 0.5% to unscored agents vs 0.1% to high-trust agents. Agents' rational choice: pay $0.02 for trust check → save 0.4% on every swap. Economic self-interest drives query volume.

### Channel 5: B2B Agent Operators (Day 60-90)

**Not now.** B2B conversations require:
- At least 3 documented "Maiat saved me" case studies
- 60+ days of stable uptime and proven accuracy
- Clear ROI story: "$5/month unlimited queries vs $X lost to untrusted agents"

**Target:** Teams running 10+ agents on ACP. One B2B deal = hundreds of daily queries.

**Offering (when ready):**
- $5/month unlimited `agent_trust` + `token_check`
- $20/month adds `agent_deep_check` + priority support
- Custom: enterprise trust integration consulting

### Channel 6: Passport Network Effect (Day 30-60)

Agents receive SBT passport → want to display trust credentials on other platforms → organic cross-platform distribution without marketing spend.

### Growth Flywheel (Self-reinforcing)

```
Free API → agent tries trust check → becomes daily habit
  → exceeds free tier → converts to ACP (paid)
    → generates QueryLog → feeds trust score calculation
      → scores more accurate → more agents query
        → more data → better scores → repeat
```

Community reviews create a parallel loop:

```
User reviews agent → community marks "helpful" → earns Scarab
  → more quality reviews → richer data → better trust scores
    → more protocols integrate → more users review → repeat
```

### Strategic Integrations (Already In Progress)

| Partner           | Integration                            | Status                              |
| ----------------- | -------------------------------------- | ----------------------------------- |
| **Chainlink CRE** | Cross-chain oracle distribution        | MaiatTrustConsumer contract written |
| **Uniswap v4**    | TrustGateHook reference implementation | Contract deployed on Base           |
| **EAS on Base**   | Cryptographic receipt infrastructure   | Live, MaiatReceiptResolver deployed |
| **Base**          | Builder Code bc_cozhkj23 (ERC-8021)    | Registered and active               |

### Content & Community Strategy

- Build in public from Day 1 (a16z playbook)
- Founder-led narrative — not outsourced to agencies
- Technical blog posts > press releases
- Community = data pipeline infrastructure, not marketing channel

**Philosophy:** Don't find users. Make the infrastructure unavoidable. Users come naturally.

### Launch Playbook (Pre-Launch: T-4 to T-0)

**T-4 — Spec Finalization + Data Prep**
- Finalize Virtuals 60 Days application spec (this document) ✅
- Run full agent analysis: identify top 10 most suspicious + top 10 most trustworthy agents
- Prepare 5 Day 1 prediction market questions
- Verify prediction market functionality on production

**T-3 — Content Production**
- Write Trust Exposé thread (11 tweets):
  - Hook: "We scanned 17,437 AI agents. 87% don't have enough history to be trusted."
  - Tweets 2-4: Most suspicious agents (data-backed)
  - Tweets 5-7: Most trustworthy agents (data-backed)
  - Tweets 8-9: Common rug patterns identified
  - Tweet 10: How Maiat catches these
  - Tweet 11: CTA → maiat-protocol.vercel.app/explore
- Prepare Virtuals application form (compress spec into required format)
- Record product demo video (2-3 min: /explore → agent detail → trust_swap → prediction market)

**T-2 — Community Warmup**
- @0xmaiat teaser: "Something big coming for AI agent safety 👀"
- Post preview in Virtuals Discord #builds
- Reach out to 2-3 Virtuals ecosystem KOLs (agent safety focused, not mega-influencers)
- Final check: all smart contracts verified on BaseScan

**T-1 — Submit + Launch Prep**
- Submit Virtuals 60 Days application
- Schedule Trust Exposé thread for launch day
- Deploy 5 prediction market questions to production
- Build free API endpoint (`/api/v1/trust`) with rate limiting
- Final QA: all pages, ACP offerings, oracle sync operational

### 60-Day Execution Plan (3/11 - 5/10)

**Week 1-2 (3/11 - 3/24) — Launch + User Acquisition**

| Day | Action | Target |
|-----|--------|--------|
| Day 1 | Trust Exposé thread goes live + Prediction Market launches | 100+ site visitors |
| Day 2-3 | Twitter Space / Virtuals Discord AMA — live trust check demo | 50+ Scarab users |
| Day 5 | First batch review data analysis + public dashboard | Transparency signal |
| Day 7 | Settle first prediction + publish results | User return visits |
| Day 10 | Second content piece: "Week 1: What 500 trust checks revealed" | Data-driven narrative |
| Day 14 | Free API officially announced + developer integration guide | SDK user acquisition |

**Week 3-4 (3/25 - 4/7) — Product Depth**

| Action | Target |
|--------|--------|
| Agent Risk Alerts live (Scarab-gated) | First valuable Scarab sink |
| Profile title system live (Scout/Sentinel/Oracle/Guardian) | Social currency |
| Second batch prediction market questions (based on Week 1-2 data) | User retention |
| First monthly buyback executed + tx hash published | Trust building |
| ElizaOS Discord integration showcase | SDK distribution |

**Week 5-6 (4/8 - 4/21) — Scale**

| Action | Target |
|--------|--------|
| Agent self-service live (claim, certify) | Supply-side revenue |
| Submit ElizaOS plugin PR (with usage data) | First step to official adoption |
| Month 1 Report: all data published transparently | Build in public |
| First B2B prospect outreach (if 3+ case studies exist) | Revenue scaling |

**Week 7-8 (4/22 - 5/10) — Maturity + Report**

| Action | Target |
|--------|--------|
| TrustGateHook first pool activation | Protocol-level revenue |
| Scarab Leaderboard live | Competition + retention |
| 60 Days Report: comprehensive data publication | Virtuals deliverable |
| Evaluate MAIAT staking readiness (based on volume data) | Phase 2 decision |

**Weekly KPI Tracking:**

| Metric | Day 7 | Day 30 | Day 60 |
|--------|-------|--------|--------|
| Site MAU | 200 | 1,000 | 3,000 |
| Active Scarab users | 50 | 300 | 800 |
| Paid ACP queries | 50 | 500 | 2,000 |
| Reviews submitted | 20 | 200 | 500 |
| Prediction market participants | 30 | 200 | 500 |
| MAIAT holders | 100 | 500 | 1,500 |

### Trust Exposé: Launch Content Strategy

**Why this is the killer launch content:**

1. **Self-distributing** — Every agent's holder/user wants to know "is my agent safe?" 17,437 agents = 17,437 potential retweet motivations
2. **Controversy = virality** — Flagging an agent as "suspicious" will trigger the agent's team to respond → debate → traffic. This isn't a bug; it's a feature.
3. **Product IS the content** — Not saying "we have a product." Directly showing product results. Ultimate "show, don't tell."
4. **Repeatable** — Monthly Trust Report becomes recurring content. Like DeFiLlama's TVL rankings — the report itself is the product.

**Risk mitigation:**
- All "suspicious" flags backed by on-chain evidence (completion rates, dispute data) — never opinion-based
- Pre-check: avoid flagging politically sensitive Virtuals ecosystem projects without ironclad data
- Prepare for pushback: data defense document ready before publishing

---

## 10. Business Model

### Current Revenue (Honest Numbers)

ACP offerings live in March 2026. Current query volume is early-stage — revenue is real but small. The infrastructure is built for scale; volume will follow adoption.

**Current monthly burn rate: <$100/month** (Railway ~$20, Supabase ~$25, gas ~$50). Extremely capital efficient. We can run indefinitely without external funding.

### Revenue Streams

**Free tier (our API — habit formation, not revenue):**

| Offering | Free Quota | Purpose |
|----------|-----------|---------|
| `agent_trust` basic score | 100/month per API key | Make trust checks a daily reflex |
| `token_check` | 50/month per API key | Lower friction for token safety |

*Note: Free API endpoint (`/api/v1/trust`) is planned for Day 7-14. Currently, trust queries are available via paid ACP offerings only.*

**Demand side — paid (ACP, for usage beyond free tier):**

| Source                | Phase | Model       | Currency | Unit Economics        |
| --------------------- | ----- | ----------- | -------- | --------------------- |
| ACP trust queries     | 1+    | Per-query   | USDC     | $0.01-$0.10 per query |
| Trust swap commission | 1+    | % of volume | USDC     | 0.15% per swap        |

**Supply side (Agent Yelp — agents pay to manage their own profiles):**

| Source              | Phase | Model        | Currency | Unit Economics         | Status |
| ------------------- | ----- | ------------ | -------- | ---------------------- | ------ |
| Agent claim         | 1     | One-time     | USDC     | $0.02 per claim        | 🔜 Day 15 |
| Agent certification | 1     | One-time     | USDC     | $0.20 per badge        | 🔜 Day 20 |
| Agent analytics     | 1     | Per-query    | USDC     | $0.03 per view         | 🔜 Day 25 |
| Agent boost (ads)   | 1-2   | Daily        | USDC     | $0.05/day per agent    | 🔜 Day 30 |
| Premium dashboard   | 2+    | Subscription | USDC     | Monthly                | Phase 2 |

**B2B plans (Day 60-90, when case studies exist):**

| Plan | Price | Includes |
|------|-------|----------|
| Starter | $5/month | Unlimited `agent_trust` + `token_check` |
| Pro | $20/month | + `agent_deep_check` + priority support |
| Enterprise | Custom | Integration consulting + dedicated oracle sync |

**Protocol-level revenue:**

| Source              | Phase | Model     | Currency | Unit Economics                  |
| ------------------- | ----- | --------- | -------- | ------------------------------- |
| Hook swap fee share | 2+    | Fee tier  | MAIAT    | 0-0.5% based on reputation tier |
| Passport mint       | 2+    | One-time  | MAIAT    | TBD per mint                    |
| Premium Data API    | 3+    | Subscribe | MAIAT    | Monthly subscription            |
| MAIAT buyback       | 1+    | Revenue % | MAIAT    | X% of USDC revenue → buy MAIAT  |

**Double-sided marketplace:** Agents who query pay USDC. Agents who get queried also pay USDC for visibility and certification. Both sides generate revenue.

### Revenue Sustainability

- Revenue is **real and immediate** from Day 1 (ACP fees)
- Not dependent on token price — protocol earns regardless of MAIAT market cap
- Burn rate so low that Automated Capital Formation at $2M FDV ($300K) funds years of operations
- Flywheel effect: more users → more data → better product → more users → more revenue

### Why Virtuals Unicorn Is the Right Framework

Traditional VC funding misaligns incentives for infrastructure protocols — VCs want fast exits, infrastructure needs patient growth. Virtuals' Unicorn model is a perfect fit:

- **Performance-based funding** — Automated Capital Formation releases USDC only as FDV grows. No free money; every dollar earned reflects real market validation.
- **Extreme capital efficiency** — Total monthly cost <$100. We don't need millions to operate; we need distribution and ecosystem support, which Virtuals provides.
- **Revenue from Day 1** — ACP fees are already live. We're not asking for runway to build a product; the product exists. Virtuals amplifies what's already working.
- **AI-augmented execution** — Solo founder with AI agents for parallelizable work. No payroll overhead, no burn rate anxiety.

---

## 11. Competitive Moat

### Why Can't Someone Fork Maiat?

Our code is open source. Our contracts are verified. Anyone can read everything we've built. **That's the point.**

What they can't fork:

### 1. Data Moat (Primary — and the only one that truly matters)

- **2,292 agents fully scored** with behavioral history — this took months of indexing, not minutes of cloning
- Every query adds data; a fork starts at zero
- Historical behavioral data (completion rates, payment rates, expire rates) is accumulated over time
- On-chain oracle records are permanent and verifiable — a fork has empty oracle slots
- **Compounding advantage:** a competitor launching today needs months to reach our current data depth, during which we're still growing

### 2. Integration Moat (Growing)

- 7 SDK packages across ElizaOS, AgentKit, GAME, MCP, Viem, Virtuals
- Any protocol calling `getTrustScore()` on MaiatOracle is integrated with **our** data, not a fork's empty database
- Switching costs increase with every integration — migrating oracle addresses across multiple protocols is painful
- **Honest caveat:** SDKs are published but not yet merged into official repos. Integration moat is real but early-stage.

### 3. Cryptographic Moat

- EAS attestations reference **our** MaiatReceiptResolver — forks can't mint Maiat Receipts
- Schema UID is permanently tied to our contracts
- Owner/Operator separation prevents single point of failure

### 4. Network Effect Moat

- More agents scored → oracle more valuable → more protocols integrate → more agents scored
- Reviews weighted by on-chain proof → can't be sybil-attacked at scale
- First-mover advantage in an infrastructure category = natural monopoly tendency

### What Is NOT a Moat

- **"Only trust service on ACP"** — This is a timing advantage, not a structural moat. Anyone can list a competing trust offering on ACP tomorrow. Our defense is data depth and integration lock-in, not absence of competitors.
- **"7 SDKs published"** — Publishing packages is easy. Getting them adopted and merged into official repos is the real moat. We're at step 1 of 3.

**Bottom line:** You can copy our code in a day. You can't copy our data in a year. Everything else is temporary advantage we need to convert into permanent lock-in.

### Competitive Landscape

No one is doing exactly what Maiat does — on-chain trust oracle for AI agents. But adjacent players exist:

| Player | What They Do | Why They're Not Maiat |
|--------|-------------|----------------------|
| **Eigentrust (by Karma3Labs)** | Graph-based reputation for Web3 | Generic reputation, not agent-specific. No ACP integration, no oracle, no SDK ecosystem |
| **DegenScore** | Wallet-level on-chain reputation | Measures DeFi activity, not agent job performance. Human-focused, not agent-focused |
| **Virtuals ACP native metrics** | Basic completion/payment rates visible on ACP | Raw data only — no composite scoring, no oracle, no cross-platform portability |
| **Manual due diligence** | Teams researching agents themselves | Doesn't scale. Works for 10 agents, impossible for 17,000+ |

Our real competition isn't another trust protocol — it's **agents not checking trust at all** (the status quo). That's why the free API tier matters: lower the friction to zero so checking trust becomes the default behavior.

---

## 12. Team

Maiat is infrastructure, not a consumer app. It doesn't need a 20-person team. It needs people who deeply understands both the trust problem and the technical stack, augmented by AI for execution velocity.

### The Story

I've been obsessed with one question for 2 years: **how do you trust a stranger on the internet?**

Started with EatNGo — a restaurant review app. Learned that centralized reviews get gamed. Built SmartReviewHub — added blockchain. Learned that on-chain data alone isn't enough without context. Built Recivo, then TruCritic — each time getting closer but missing a piece. TruCritic taught me the critical lesson: off-chain scores aren't composable. If another protocol can't read your trust data in a smart contract, it doesn't exist.

That's when Ma'at became Maiat — the version with an on-chain oracle, EAS attestations, and SDK integrations. Five failures, one insight: **trust has to be on-chain, machine-readable, and cryptographically verified, or it's just another database.**

I'm not building Maiat because it's a good idea. I'm building it because I've tried every other way and they all failed.

### JhiNResH — Founder

- **X:** [@JhiNResH](https://x.com/JhiNResH)
- **GitHub:** [github.com/JhiNResH](https://github.com/JhiNResH)

**What we've shipped:**

- 4 mainnet smart contracts on Base (MaiatOracle, MaiatReceiptResolver, TrustGateHook, EAS Schema)
- 7 npm packages published and maintained
- 139 Foundry tests (unit + fuzz)
- Full-stack web app (Next.js 15 + Prisma + PostgreSQL)
- ACP agent runtime on Railway
- 4 automated cron jobs (indexer, attestor, oracle sync, market resolver)

**Why we're the right people:**

- Built 5 iterations of trust infrastructure over 2+ years (EatNGo → SmartReviewHub → Recivo → TruCritic → Ma'at → Maiat)
- Each failure taught a specific lesson: EatNGo taught that centralized reviews don't work; TruCritic taught that off-chain scores aren't composable; Ma'at taught that you need an oracle, not just an API
- Full-stack + Solidity + security mindset — no dependency on external devs for core protocol work

**AI-Augmented Development:**

- We make architecture decisions, write core protocol logic, and review all code
- 4 specialized AI agents handle parallelizable execution: engineering tasks, security audits (Slither/Foundry), content creation, and market research
- Think of it like a solo founder with a 24/7 team of freelancers — except they never sleep, never miss deadlines, and cost near-zero. The founder drives strategy; the agents execute in parallel.
- This is not "AI-dependent." Remove the AI agents tomorrow and development slows 4x, but the product still works and the founder still ships.

**Bus factor mitigation:**

- All code open source on GitHub
- All contracts verified on BaseScan
- Documentation comprehensive (API docs, SDK guides, contract ABIs)
- Anyone can fork and continue if needed — that's the beauty of open source infrastructure

---

## 13. Risk Factors (Honest Assessment)

| Risk                         | Severity        | Mitigation                                                                                           |
| ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| **Trust score gaming/manipulation** | **Critical** | **Existential risk.** If agents farm good scores then rug, the oracle loses all credibility. Mitigations: (1) Rolling window scoring — recent behavior weighted higher than historical, so score drops fast on bad behavior; (2) Anomaly detection — sudden spikes in completion rate from self-dealing flagged automatically; (3) Community review layer (30% weight) acts as human check on pure behavioral data; (4) Blacklist mechanism — confirmed bad actors permanently flagged in oracle; (5) "Insufficient Data" label for agents with <3 transactions prevents false confidence in new agents. |
| Low initial query volume     | High            | Free API tier removes payment friction. SDK default-on behavior creates passive query generation. ACP position provides baseline visibility. |
| Smart contract vulnerability | Critical        | 139 Foundry tests, Owner/Operator separation, MaiatReceiptResolver blocks unauthorized attestations   |
| Solo founder bus factor      | Medium          | Open source code, verified contracts, comprehensive docs. Protocol can survive without founder.      |
| ACP ecosystem stagnation     | Medium          | Multi-framework SDK support (ElizaOS, AgentKit, GAME, MCP) reduces dependency on any single platform |
| Token price decline          | Low impact      | Revenue model works regardless of token price. Burn rate <$100/month. Can operate indefinitely.      |
| Regulatory uncertainty       | Low (currently) | Trust scores are public data, not financial advice. No custody of user funds.                        |
| Competitor enters ACP trust space | Medium     | ACP position is timing advantage, not structural moat. Real defense is data depth — competitor starts at zero scored agents while we have 2,292+. Every day widens the gap. |

---

## 14. Links

- **Web App:** [maiat-protocol.vercel.app](https://maiat-protocol.vercel.app)
- **API Docs:** [maiat-protocol.vercel.app/docs](https://maiat-protocol.vercel.app/docs)
- **GitHub (Protocol):** [github.com/JhiNResH/maiat-protocol](https://github.com/JhiNResH/maiat-protocol)
- **GitHub (Agent):** [github.com/JhiNResH/maiat-acp](https://github.com/JhiNResH/maiat-acp)
- **ACP Agent:** [app.virtuals.io/acp](https://app.virtuals.io/acp) (Agent #18281)
- **Twitter (Project):** [@0xmaiat](https://x.com/0xmaiat)
- **Twitter (Founder):** [@JhiNResH](https://x.com/JhiNResH)
- **Base Builder Code:** bc_cozhkj23
- **BaseScan Contracts:** All verified on Base mainnet
- **Product Demo:** Video walkthrough of /explore, agent detail, trust_swap, and prediction market — recording scheduled pre-submission

---

_We built the product first. We're launching the token after. Not because a whitepaper told us to — because 5 failed iterations taught us there's no other way that works._

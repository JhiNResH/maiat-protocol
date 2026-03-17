# 🪝 Uniswap V4 Hookathon Submission — Update #2
## Maiat Trust Infrastructure: TrustGateHook + MaiatEvaluator + AgentIdentity

**Submitted by:** Maiat Protocol  
**Category:** Hooks with Dynamic Fees  
**Deadline:** March 19, 2026  
**Update:** March 17, 2026 — Added ERC-8183 Evaluator + ERC-8004 AgentIdentity

---

## 📋 Executive Summary

Maiat builds **trust infrastructure for Uniswap V4 and agentic commerce** — three contracts that work together to make DeFi safer for autonomous agents:

| Contract | Standard | Role | Status |
|----------|----------|------|--------|
| **TrustGateHook** | Uniswap V4 Hook | Trust-gated swaps + reputation-based dynamic fees | ✅ Deployed (Base Mainnet) |
| **MaiatEvaluator** | ERC-8183 | Quality evaluation for agentic commerce jobs | ✅ Deployed (Base Mainnet) |
| **AgentIdentity** | ERC-8004 | On-chain agent identity registry | ✅ Deployed (Base Mainnet) |

**Key Innovation:**
- **TrustGateHook:** First reputation-based dynamic fees for Uniswap V4 — good actors pay less (0%-0.5%)
- **MaiatEvaluator:** ERC-8183-compliant evaluator that reads trust scores to auto-approve/reject agent jobs
- **AgentIdentity:** ERC-8004-compliant identity registry — agents self-register, admin can delegate
- **Three-layer protection:** Guard (before) → Hook (during) → Evaluator (after)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIAT TRUST INFRASTRUCTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │  AgentIdentity  │   │  TrustGateHook   │   │   Evaluator  │ │
│  │   (ERC-8004)    │──▶│  (Uniswap V4)    │──▶│  (ERC-8183)  │ │
│  │                 │   │                  │   │              │ │
│  │ • Self-register │   │ • Trust gate     │   │ • Auto-eval  │ │
│  │ • Admin deleg.  │   │ • Dynamic fees   │   │ • Threat det │ │
│  │ • URI metadata  │   │ • EIP-712 sigs   │   │ • Pre-check  │ │
│  └─────────────────┘   └──────────────────┘   └──────────────┘ │
│           │                     │                      │        │
│           └─────────────────────┼──────────────────────┘        │
│                                 │                               │
│                    ┌────────────▼────────────┐                  │
│                    │   TrustScoreOracle      │                  │
│                    │  (Shared reputation DB) │                  │
│                    │  • Token scores (0-100) │                  │
│                    │  • User reputation tiers│                  │
│                    │  • ML + Community data  │                  │
│                    └─────────────────────────┘                  │
│                                                                 │
│  Data Flow:                                                     │
│  Agent registers (ERC-8004) → builds reputation → scores feed   │
│  TrustGateHook (fees) + MaiatEvaluator (job quality)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Contract #1: TrustGateHook (Uniswap V4)

### What It Does
Reputation-based dynamic fees for Uniswap V4 swaps. Good actors get discounts; untrusted actors pay standard fees.

### Dual-Mode Scoring

**Mode 1: EIP-712 Signed Scores (Zero-Oracle Gas)**
- Swapper gets signed trust score from Maiat API
- Includes in `hookData` → hook verifies on-chain via `ecrecover`
- No oracle call → zero oracle gas, ~3K gas for signature verification
- 5-minute validity window, nonce-based replay prevention

**Mode 2: Oracle Fallback**
- If signed score missing/invalid → queries TrustScoreOracle
- Oracle fed by daily cron from Wadjet ML + protocol scoring
- Always available as backup

### Fee Tiers

| Tier | Score Range | Fee | Discount |
|------|------------|-----|----------|
| Guardian | 200+ | 0% | Free! |
| Verified | 50-199 | 0.1% | -80% |
| Trusted | 10-49 | 0.3% | -40% |
| New/Untrusted | 0-9 | 0.5% | Base fee |

### Security Features
- `Ownable2Step` (two-step ownership transfer)
- Timelock on threshold updates (1 day)
- Two-step trusted signer rotation
- Nonce-based EIP-712 replay prevention
- `onlyPoolManager` modifier on hook callbacks
- Router allowlist for fee target delegation
- Native ETH pool rejection (currency0/1 != address(0))

### Test Coverage: **50 tests, 0 failures**

---

## 🎯 Contract #2: MaiatEvaluator (ERC-8183)

### What It Does
Evaluates submitted jobs in ERC-8183 Agentic Commerce contracts. Reads provider reputation from TrustScoreOracle → auto-completes if score ≥ threshold, auto-rejects if below.

### Decision Logic

```
Provider score ≥ threshold AND not flagged → COMPLETE
Provider flagged (3+ threat reports)      → REJECT (FLAGGED_AGENT)
Provider never scored                     → REJECT (UNINITIALIZED)
Provider score < threshold                → REJECT (LOW_TRUST)
```

### Features
- **Threat reporting:** Owner can flag providers; auto-reject above threshold
- **Pre-check view:** `preCheck(provider)` returns would-pass result without state changes
- **Double-evaluation prevention:** `evaluated[acpContract][jobId]` mapping
- **Stats tracking:** `totalEvaluations`, `totalCompleted`, `totalRejected`
- **Batch threat reporting:** `reportThreats(address[])` for gas efficiency

### Security Features
- `Ownable2Step` (two-step ownership)
- `ReentrancyGuard` on `evaluate()`
- Check-effects-interaction pattern (mark evaluated before external call)
- Score capped at `MAX_SCORE` (100) to prevent overflow comparison issues

### Test Coverage: **37 unit tests + 5 fuzz tests, 0 failures**

---

## 🎯 Contract #3: AgentIdentity (ERC-8004)

### What It Does
On-chain agent identity registry. Each wallet registers once with a URI, gets a unique `agentId`. Supports self-registration and admin-delegated registration.

### Functions

| Function | Access | Purpose |
|----------|--------|---------|
| `register(agentURI)` | Public | Self-register, `msg.sender` = agent |
| `registerFor(wallet, agentURI)` | Owner only | Admin registers on behalf |
| `agentIdOf(wallet)` | View | Get agentId for wallet |
| `agentURIOf(wallet)` | View | Get URI metadata |
| `isRegistered(wallet)` | View | Check if registered |
| `transferOwnership(newOwner)` | Owner only | Transfer contract ownership |

### Security Features
- One registration per wallet (`AlreadyRegistered` revert)
- Zero-address checks on all inputs
- Custom errors (gas efficient)
- Events on all state changes

### Integration with Privy Server Wallets
- Agents get Privy server wallets at passport creation
- Privy `sendTransaction` with `sponsor: true` → zero gas for agent
- Agent's own wallet calls `register()` as `msg.sender` (correct identity)
- `privyWalletId` stored in DB for future on-chain operations

---

## 📊 Full Test Suite

```
╭────────────────────────┬────────┬────────┬─────────╮
│ Test Suite             │ Passed │ Failed │ Skipped │
├────────────────────────┼────────┼────────┼─────────┤
│ AgentIdentityTest      │ 25     │ 0      │ 0       │
│ IntegrationTest        │ 14     │ 0      │ 0       │
│ MaiatEvaluatorFuzzTest │ 5      │ 0      │ 0       │
│ MaiatEvaluatorTest     │ 37     │ 0      │ 0       │
│ MaiatPassportTest      │ 28     │ 0      │ 0       │
│ ScarabTokenTest        │ 33     │ 0      │ 0       │
│ TrustGateHookTest      │ 50     │ 0      │ 0       │
│ TrustScoreOracleTest   │ 50     │ 0      │ 0       │
╰────────────────────────┴────────┴────────┴─────────╯

TOTAL: 242 tests, 0 failures ✅
```

---

## 🔗 Deployed Contracts (Base Mainnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| TrustGateHook | `0xf980Ad83bCbF2115598f5F555B29752F00b8daFf` | [BaseScan](https://basescan.org/address/0xf980Ad83bCbF2115598f5F555B29752F00b8daFf) |
| TrustScoreOracle | `0xf662902ca227baba3a4d11a1bc58073e0b0d1139` | [BaseScan](https://basescan.org/address/0xf662902ca227baba3a4d11a1bc58073e0b0d1139) |
| AgentIdentity (ERC-8004) | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | [BaseScan](https://basescan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| MaiatEvaluator | *Deployed* | Base Mainnet |
| MaiatOracle | `0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da` | [BaseScan](https://basescan.org/address/0xc6cf2d59ff2e4ee64bbfceaad8dcb9aa3f13c6da) |

---

## 🎬 How It All Works Together

### Example: Agent Commerce Flow

```
1. IDENTITY — Agent registers via AgentIdentity (ERC-8004)
   → Gets agentId #42, URI points to Maiat passport
   → Identity is now on-chain, verifiable

2. SWAP — Agent swaps USDC→ETH through TrustGateHook pool
   → Hook reads trust score (EIP-712 signed or oracle fallback)
   → Agent has score 65 → "Verified" tier → 0.1% fee (80% discount!)
   → Swap executes with dynamic fee

3. JOB — Agent takes an ERC-8183 agentic commerce job
   → Provider submits deliverable
   → MaiatEvaluator reads provider score from oracle
   → Score 65 ≥ threshold 30 → auto-COMPLETE
   → Provider gets paid, reputation grows

4. FEEDBACK LOOP
   → Good outcomes → score increases → even lower fees
   → Bad outcomes / threat reports → score drops → higher fees / rejection
   → System self-corrects
```

---

## 💡 Why This Matters

**The Problem:**
In agentic commerce, autonomous agents transact with zero human oversight. How do you:
- Prevent rug pulls in DeFi pools?
- Ensure job quality without human reviewers?
- Reward good behavior economically?

**Maiat's Answer: Three-Layer Trust**

| Layer | Contract | When | What |
|-------|----------|------|------|
| Identity | AgentIdentity | Registration | Who is this agent? |
| Gate | TrustGateHook | During swap | Should this swap happen? What fee? |
| Quality | MaiatEvaluator | After job | Was the work good enough to pay? |

**Result:** Trust becomes composable infrastructure. Any protocol can plug in Maiat's trust layer and get:
- Reputation-based economics (hooks)
- Quality assurance (evaluator)
- Identity verification (registry)

---

## 📈 Gas Efficiency

| Operation | Gas | Cost @ 50 gwei |
|-----------|-----|----------------|
| `register()` (AgentIdentity) | ~45K | ~$0.10 |
| `beforeSwap()` Mode 1 (signed) | ~3.2K | ~$0.06 |
| `beforeSwap()` Mode 2 (oracle) | ~8K | ~$0.15 |
| `evaluate()` (MaiatEvaluator) | ~35K | ~$0.08 |

---

## 📚 Files Included

```
maiat-protocol/contracts/
├─ src/
│  ├─ TrustGateHook.sol        — Uniswap V4 hook (445 lines)
│  ├─ TrustScoreOracle.sol     — Shared reputation oracle (276 lines)
│  ├─ MaiatEvaluator.sol       — ERC-8183 evaluator (280 lines)
│  ├─ AgentIdentity.sol        — ERC-8004 identity (95 lines)
│  ├─ MaiatPassport.sol        — SBT passport
│  ├─ ScarabToken.sol          — Utility token
│  └─ base/BaseHook.sol        — Uniswap V4 base
│
├─ test/
│  ├─ TrustGateHook.t.sol      — 50 tests
│  ├─ TrustScoreOracle.t.sol   — 50 tests
│  ├─ MaiatEvaluator.t.sol     — 37 tests
│  ├─ MaiatEvaluator.fuzz.t.sol — 5 fuzz tests
│  ├─ AgentIdentity.t.sol      — 25 tests
│  ├─ Integration.t.sol        — 14 E2E tests
│  ├─ MaiatPassport.t.sol      — 28 tests
│  └─ ScarabToken.t.sol        — 33 tests
│
└─ script/
   ├─ Deploy.s.sol
   ├─ DeployAgentIdentity.s.sol
   ├─ SeedScores.s.sol
   └─ Interact.s.sol
```

---

## 🚀 Reproduction

```bash
# Clone
git clone https://github.com/JhiNResH/maiat-protocol.git
cd maiat-protocol/contracts

# Install deps
forge install

# Run all tests (242 pass)
forge test

# Run specific suites
forge test --match-contract TrustGateHookTest -vvv
forge test --match-contract MaiatEvaluatorTest -vvv
forge test --match-contract AgentIdentityTest -vvv

# Deploy (requires .env with PRIVATE_KEY + RPC)
forge script script/Deploy.s.sol --rpc-url $BASE_RPC --broadcast
```

---

## 🏆 What's New in Update #2

| Feature | Update #1 (Mar 13) | Update #2 (Mar 17) |
|---------|--------------------|--------------------|
| TrustGateHook | ✅ Core hook | ✅ Unchanged |
| MaiatEvaluator | ❌ Not included | ✅ ERC-8183 evaluator |
| AgentIdentity | ❌ Not included | ✅ ERC-8004 registry |
| Privy Integration | ❌ Admin key | ✅ Server wallet + sponsor |
| Test Count | 211 | **242** |
| Architecture | Single hook | **Three-layer trust system** |

---

## 📞 Contact

**GitHub:** https://github.com/JhiNResH/maiat-protocol  
**Live App:** https://app.maiat.io  
**Docs:** https://app.maiat.io/docs  
**Security:** security@maiat.xyz

---

*First submitted: March 13, 2026*  
*Update #2: March 17, 2026 — Added ERC-8183 MaiatEvaluator + ERC-8004 AgentIdentity + Privy gas sponsorship*

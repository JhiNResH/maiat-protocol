# Maiat Protocol — Full Security Audit Report

**Auditor:** Patrick Collins (Security Specialist)  
**Methodology:** Trail of Bits — Ultra-Granular Context Building + Automated Tooling  
**Date:** 2026-03-10  
**Commit:** HEAD (`/Users/jhinresh/maiat-protocol/contracts`)  
**Status:** ⛔ **NO-GO for Mainnet** — 1 Critical blocker must be fixed first

---

## 1. Executive Summary

I audited all six Solidity contracts in the Maiat Protocol. The codebase is well-structured and the developer clearly understands the Uniswap V4 hook model. Test coverage is excellent for core contracts (100% on TrustScoreOracle, MaiatPassport, ScarabToken, MaiatTrustConsumer — measured against production code).

However, there is **one Critical bug that makes the entire Chainlink integration non-functional**: the `ITrustScoreOracle` interface inside `MaiatTrustConsumer.sol` is missing the `DataSource` parameter in both function signatures. This causes a **function selector mismatch** — every Chainlink report delivery will silently revert. The oracle will never be updated via the Chainlink CRE path.

Additionally, there are multiple High/Medium centralization and trust-model concerns that must be addressed before mainnet.

**Finding Summary:**

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| MAIAT-001 | ITrustScoreOracle interface mismatch — Chainlink integration non-functional | Critical | Open |
| MAIAT-002 | Flash score manipulation by UPDATER_ROLE — trust gate bypass | High |  Open |
| MAIAT-003 | CEI violation in `onReport` — reentrancy window on replay guard | Medium | Open |
| MAIAT-004 | hookData user address spoofing — any router can claim any fee tier | Medium | Open |
| MAIAT-005 | Owner can lower trustThreshold to 1 — near-complete gate bypass | Medium | Open |
| MAIAT-006 | Single UPDATER_ROLE key — complete centralization of trust data | Low | Open |
| MAIAT-007 | TOCTOU between `getScore()` and `getDataSource()` in `beforeSwap` | Low | Open |
| MAIAT-008 | `batchUpdateTokenScores` forces single DataSource across entire batch | Low | Open |
| MAIAT-009 | Broken `@openzeppelin/` remapping — ScarabToken won't compile in clean env | Low | Open |
| MAIAT-010 | `SCORE_MAX_AGE` = 7 days is excessively long for DeFi | Informational | Open |
| MAIAT-011 | `adminBurn` allows owner to burn any user's ScarabToken balance | Informational | Open |
| MAIAT-012 | MaiatPassport admin holds all three roles | Informational | Open |
| MAIAT-013 | BaseHook stub functions lack `getHookPermissions` test coverage | Informational | Open |

---

## 2. Scope & Methodology

### Files Audited

| File | Lines | Notes |
|------|-------|-------|
| `src/TrustScoreOracle.sol` | 186 | Primary audit target |
| `src/TrustGateHook.sol` | 160 | Primary audit target |
| `src/base/BaseHook.sol` | 90 | Supporting |
| `src/MaiatPassport.sol` | 104 | Supporting |
| `src/ScarabToken.sol` | 91 | Supporting |
| `src/MaiatTrustConsumer.sol` | 202 | Supporting |

### Methodology (Trail of Bits)

1. **Phase 1 — Deep Context Building**: Line-by-line analysis of every function. Module mapping, actor identification, storage variable analysis, trust boundary reconstruction, invariant enumeration.

2. **Phase 2 — Automated Tooling**: Slither static analysis, Forge test suite, Forge coverage analysis.

3. **Phase 3 — Manual Vulnerability Assessment**: Targeted hunting on known risk areas plus systematic review of all external interactions.

4. **Phase 4 — Mainnet Go/No-Go Assessment**.

---

## 3. System Overview

### Architecture

```
[Chainlink CRE] → MaiatTrustConsumer.onReport()
                     ↓
              TrustScoreOracle (off-chain API / community reviews → on-chain)
                     ↑
              TrustGateHook.beforeSwap()
                     ↑
              Uniswap V4 PoolManager (swap events)
                     
[Users] → MaiatPassport (soulbound ERC-721, trust score NFT)
[Users] → ScarabToken (reputation ERC-20, deflationary)
```

### Actors & Trust Levels

| Actor | Trust Level | Capabilities |
|-------|-------------|--------------|
| `DEFAULT_ADMIN_ROLE` | Highest | Pause/unpause oracle, grant/revoke roles |
| `UPDATER_ROLE` | High | Update any token score, update any user reputation |
| `Ownable` (TrustGateHook) | High | Change trust threshold (1–100), transfer ownership |
| `Ownable2Step` (Consumer) | High | Change forwarder, propose oracle update |
| `MINTER_ROLE` (Passport) | Medium | Mint soulbound passports |
| Chainlink Forwarder | External-trusted | Deliver signed CRE reports |
| End Users | Untrusted | Swap via V4, hold passport/scarab |

### Key Invariants

1. Token scores are only valid if `lastUpdated != 0 && block.timestamp - lastUpdated <= 7 days`
2. DataSource.SEED tokens are always blocked at the hook level
3. `onlyPoolManager` prevents direct `beforeSwap` calls from untrusted callers
4. Soulbound: `from != address(0) && to != address(0)` reverts on passport transfers
5. `trustThreshold` must be in [1, 100]
6. One passport per address enforced via `hasPassport` mapping

### State Variables — Critical Storage

**TrustScoreOracle:**
- `tokenScores: mapping(address => TokenScore)` — the source of truth for gate decisions
- `userReputations: mapping(address => UserReputation)` — fee tier determination
- `UPDATER_ROLE` — controls both mappings with no timelock

**TrustGateHook:**
- `oracle: immutable TrustScoreOracle` — cannot be changed after deploy
- `trustThreshold: uint256` — gate cutoff, owner-controlled

**MaiatTrustConsumer:**
- `oracle: ITrustScoreOracle` — updateable with 2-day timelock
- `forwarder: address` — immediately updateable by owner
- `lastReportBlock: mapping(bytes32 => uint256)` — replay protection

---

## 4. Findings

---

### MAIAT-001 — Interface Mismatch: Chainlink Integration Non-Functional

**Severity:** 🔴 Critical  
**Location:** `src/MaiatTrustConsumer.sol` — `ITrustScoreOracle` interface (lines 13–28)  
**Status:** Open

#### Description

`MaiatTrustConsumer` defines a local `ITrustScoreOracle` interface to call the `TrustScoreOracle`. Both functions in this interface are **missing the `DataSource` parameter** that the real `TrustScoreOracle` requires:

```solidity
// MaiatTrustConsumer.sol (line 13-28) — WRONG
interface ITrustScoreOracle {
    function updateTokenScore(
        address token, uint256 score, uint256 reviewCount, uint256 avgRating
    ) external;

    function batchUpdateTokenScores(
        address[] calldata tokens, uint256[] calldata scores,
        uint256[] calldata reviewCounts, uint256[] calldata avgRatings
    ) external;
}

// TrustScoreOracle.sol — ACTUAL signature
function batchUpdateTokenScores(
    address[] calldata tokens, uint256[] calldata scores,
    uint256[] calldata reviewCounts, uint256[] calldata avgRatings,
    DataSource dataSource    // ← MISSING in interface
) external onlyRole(UPDATER_ROLE) whenNotPaused { ... }
```

This produces a **function selector mismatch**:

```
MaiatTrustConsumer calls: batchUpdateTokenScores(address[],uint256[],uint256[],uint256[])
  → selector: 0x4b285208

TrustScoreOracle exposes: batchUpdateTokenScores(address[],uint256[],uint256[],uint256[],uint8)
  → selector: 0x3dc8b1b8
```

Verified with `cast sig`:
```
$ cast sig "batchUpdateTokenScores(address[],uint256[],uint256[],uint256[])"    → 0x4b285208
$ cast sig "batchUpdateTokenScores(address[],uint256[],uint256[],uint256[],uint8)" → 0x3dc8b1b8
```

TrustScoreOracle has no fallback. Calling selector `0x4b285208` on it will **revert with empty revert data**. This means every Chainlink CRE report delivery via `onReport()` will fail.

The test suite masks this by using a `MockOracle` that deliberately matches the broken 4-parameter interface:

```solidity
// MaiatTrustConsumer.t.sol
/// @notice Mock oracle that accepts batchUpdateTokenScores WITHOUT DataSource param
///         (matches MaiatTrustConsumer's internal ITrustScoreOracle interface)
contract MockOracle { ... }
```

This is an integration test gap. The unit tests pass but the production wiring is broken.

#### Impact

- **Complete failure of Chainlink oracle pipeline.** No token scores can be updated via the Chainlink CRE path.
- The protocol degrades to manual UPDATER_ROLE calls only, which itself is a centralization risk.
- Users cannot benefit from community-review-driven trust scores via Chainlink.

#### Proof of Concept

```solidity
// Deploy real contracts
TrustScoreOracle oracle = new TrustScoreOracle(admin);
MaiatTrustConsumer consumer = new MaiatTrustConsumer(forwarder, address(oracle), owner, workflowOwner);

// Grant UPDATER_ROLE to consumer
oracle.grantRole(oracle.UPDATER_ROLE(), address(consumer));

// Simulate Chainlink report delivery — will REVERT
vm.prank(forwarder);
consumer.onReport(metadata, abi.encode(tokens, scores, reviewCounts, avgRatings));
// ↑ Reverts with empty data — selector 0x4b285208 not found on oracle
```

#### Recommendation

Fix the `ITrustScoreOracle` interface to include `DataSource`:

```solidity
// Option A: Add DataSource enum to the interface
interface ITrustScoreOracle {
    enum DataSource { NONE, SEED, API, COMMUNITY, VERIFIED }

    function updateTokenScore(
        address token, uint256 score, uint256 reviewCount,
        uint256 avgRating, DataSource dataSource
    ) external;

    function batchUpdateTokenScores(
        address[] calldata tokens, uint256[] calldata scores,
        uint256[] calldata reviewCounts, uint256[] calldata avgRatings,
        DataSource dataSource
    ) external;
}

// Option B: Import TrustScoreOracle directly and use its interface
// (simpler, avoids interface drift)
import {TrustScoreOracle} from "./TrustScoreOracle.sol";
```

Also add an integration test that uses the real `TrustScoreOracle` (not a mock) to prevent regression.

Additionally, the Chainlink report currently has no mechanism to specify `DataSource`. The team must decide what DataSource value Chainlink-delivered reports should carry (likely `API` or `VERIFIED`). Hardcode or encode it in the report format.

---

### MAIAT-002 — Flash Score Manipulation by UPDATER_ROLE

**Severity:** 🟠 High  
**Location:** `src/TrustScoreOracle.sol` — `updateTokenScore`, `batchUpdateTokenScores`  
**Status:** Open

#### Description

`UPDATER_ROLE` can update any token score with **immediate effect and no timelock**. A malicious or compromised UPDATER_ROLE key can:

1. In a single block/bundle:
   - Set a scam token's trust score to 99 (passes the 30-threshold gate)
   - Execute swaps against liquidity providers through the trusted hook
   - Reset the token score back to 0

2. Alternatively, simply whitelist harmful tokens temporarily to drain LPs.

The oracle itself has a `pause()` function for emergencies, but the admin (who can pause) is likely the same entity as the UPDATER_ROLE.

There is no minimum lock period between score updates. A score of 0 → 99 → 0 in 3 transactions is valid.

#### Impact

- Scam/malicious tokens can be temporarily whitelisted
- Liquidity providers in hook-gated pools are exposed to rug tokens
- One compromised private key = full control over which tokens are tradeable

#### Proof of Concept

```solidity
// Attacker controls UPDATER_ROLE key
// tx1: Flash-whitelist scam token
oracle.updateTokenScore(scamToken, 99, 100, 450, DataSource.VERIFIED);

// tx2: Swap scam token (passes trust gate since score=99 > threshold=30)
// LP gets scam tokens, attacker gets legitimate tokens

// tx3: Remove score
oracle.updateTokenScore(scamToken, 0, 0, 0, DataSource.NONE);
```

#### Recommendation

Add a **score update timelock**: new scores don't take effect immediately but after a delay (e.g., 1 hour):

```solidity
struct PendingScore {
    uint256 trustScore;
    uint256 effectiveAt; // block.timestamp + SCORE_UPDATE_DELAY
    DataSource dataSource;
    // ...
}
mapping(address => PendingScore) public pendingScores;
uint256 public constant SCORE_UPDATE_DELAY = 1 hours;

function getScore(address token) external view returns (uint256) {
    if (pendingScores[token].effectiveAt <= block.timestamp) {
        // apply pending score
    }
    // ...
}
```

At minimum, add a 2-of-N multisig requirement for score updates, or implement Gnosis Safe-gated UPDATER_ROLE.

---

### MAIAT-003 — CEI Violation in `onReport()` — Reentrancy Window

**Severity:** 🟡 Medium  
**Location:** `src/MaiatTrustConsumer.sol` — `onReport()` (lines 109–143)  
**Status:** Open

#### Description

`onReport()` violates the Checks-Effects-Interactions (CEI) pattern: state is written **after** an external call.

```solidity
// Line 121: CHECK (replay protection)
if (lastReportBlock[workflowId] == block.number) {
    revert MaiatTrustConsumer__DuplicateReport(...);
}

// Lines 128-132: decode report (no external call yet)

// Line 134: INTERACTION — external call to oracle
oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);

// Lines 137-140: EFFECT — state written AFTER interaction ← violation
lastReportBlock[workflowId] = block.number;  // replay guard update
lastWorkflowId = workflowId;
lastReportTimestamp = block.timestamp;
reportCount++;
```

If a malicious oracle reenters `onReport()` during `batchUpdateTokenScores`, the replay guard has not yet been set. The reentrancy check at line 121 would pass again (same workflowId, same block, guard not yet written). This allows a malicious oracle to bypass the same-block replay protection.

The practical risk is low because:
- `oracle` is set via a 2-day timelock
- `forwarder` is a trusted Chainlink address

But the pattern is wrong and could become exploitable if trust assumptions break.

#### Recommendation

Move state writes before the external call (CEI pattern):

```solidity
function onReport(bytes calldata metadata, bytes calldata report) external override {
    if (msg.sender != forwarder) revert ...;

    (bytes32 workflowId,, address workflowOwner) = _decodeMetadata(metadata);
    
    if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) revert ...;
    
    if (lastReportBlock[workflowId] == block.number) revert ...;
    
    // Decode
    (address[] memory tokens, ...) = abi.decode(report, (...));
    
    // ✅ EFFECTS first
    lastReportBlock[workflowId] = block.number;
    lastWorkflowId = workflowId;
    lastReportTimestamp = block.timestamp;
    reportCount++;
    
    // ✅ INTERACTION last
    oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);
    
    emit ReportReceived(workflowId, tokens.length, block.timestamp);
}
```

---

### MAIAT-004 — hookData User Address Spoofing

**Severity:** 🟡 Medium  
**Location:** `src/TrustGateHook.sol` — `beforeSwap()` (lines 130–135)  
**Status:** Open

#### Description

The hook applies per-user fee discounts based on an address decoded from `hookData`:

```solidity
address feeTarget = sender; // router by default
if (hookData.length >= 32) {
    feeTarget = abi.decode(hookData, (address)); // ← no validation
}
uint256 feeBps = oracle.getUserFee(feeTarget);
```

There is **no validation** that the decoded address is the actual end user. Any router passing through this hook can encode any address (including a Guardian-tier user) to claim a 0% fee. The code comment acknowledges this: *"encode the user address in hookData via a trusted router"* — but there is no on-chain enforcement of which routers are trusted.

The economic impact: users with high reputation (Guardian tier) paid real costs (gas, time, community reviews, scarab tokens) to earn 0% fees. Any anonymous swapper can claim their fee discount for free by encoding their address in hookData.

#### Impact

- Fee discount system can be fully circumvented
- Economic incentive to earn reputation is undermined
- Protocol fee revenue is reduced (fee discounts claimed fraudulently)
- Users who earned reputation see no competitive advantage

#### Proof of Concept

```solidity
// Alice is Guardian tier (earned through months of reviews)
// Bob is a new user with BASE_FEE (0.5%)
// Bob can claim Alice's 0% fee in any swap:
bytes memory hookData = abi.encode(alice);
// Hook applies alice's fee (0%) to Bob's swap
```

#### Recommendation

Implement an on-chain trusted router registry:

```solidity
mapping(address => bool) public trustedRouters;

function beforeSwap(...) {
    address feeTarget = sender;
    if (hookData.length >= 32 && trustedRouters[sender]) {
        feeTarget = abi.decode(hookData, (address));
    }
    // If sender is not a trusted router, use router-level fee (sender)
}
```

Or use EIP-712 signed user intents — the router must provide a signature from `feeTarget` to prove identity.

---

### MAIAT-005 — Owner Can Set trustThreshold to 1

**Severity:** 🟡 Medium  
**Location:** `src/TrustGateHook.sol` — `updateThreshold()` (line 72)  
**Status:** Open

#### Description

```solidity
uint256 public constant MIN_THRESHOLD = 1;

function updateThreshold(uint256 newThreshold) external onlyOwner {
    if (newThreshold > 100) revert TrustGateHook__InvalidThreshold(newThreshold);
    if (newThreshold < MIN_THRESHOLD) revert TrustGateHook__ThresholdTooLow(newThreshold);
    trustThreshold = newThreshold;
}
```

The minimum threshold is 1, not a meaningful security floor. Setting `trustThreshold = 1` means any token with a non-zero score passes the gate. Since the oracle can set scores to 1 for any token (including SEED-scored ones), a threshold of 1 combined with a score of 1 effectively disables the trust gate for that token.

Furthermore, there is no timelock on `updateThreshold`. The owner can atomically lower the threshold in the same block as an adversarial swap.

#### Impact

- Threshold can be atomically reduced to 1 and raised back, similar to MAIAT-002 but at the hook level
- Systemic risk if owner key is compromised

#### Recommendation

1. Set a meaningful minimum threshold (e.g., 30 — the current default):
   ```solidity
   uint256 public constant MIN_THRESHOLD = 30;
   ```
2. Add a timelock for threshold changes (24h minimum delay)
3. Emit a timelock event so off-chain monitoring can detect manipulation before it takes effect

---

### MAIAT-006 — Single UPDATER_ROLE Key — Full Centralization

**Severity:** 🔵 Low  
**Location:** `src/TrustScoreOracle.sol` — `UPDATER_ROLE`  
**Status:** Open

#### Description

A single EOA or hot wallet holding `UPDATER_ROLE` has complete, unilateral control over:
- All token trust scores (including setting them above the threshold)
- All user reputation scores (including granting Guardian-tier fees)
- Both `updateTokenScore` and `batchUpdateTokenScores`

There is no multi-sig requirement, no timelock on score updates, and no rate limiting.

Key compromise = complete oracle manipulation.

#### Recommendation

- Use a Gnosis Safe (3-of-5 multisig) as the UPDATER_ROLE holder
- Implement `SCORE_UPDATE_DELAY` as recommended in MAIAT-002
- Separate UPDATER_ROLE into TOKEN_UPDATER_ROLE and USER_UPDATER_ROLE for least-privilege access

---

### MAIAT-007 — TOCTOU Between `getScore()` and `getDataSource()` in `beforeSwap`

**Severity:** 🔵 Low  
**Location:** `src/TrustGateHook.sol` — `beforeSwap()` (lines 98–118)  
**Status:** Open

#### Description

`beforeSwap` makes two separate external calls to the oracle per token:
1. `oracle.getScore(token)` — checks score AND staleness
2. `oracle.getDataSource(token)` — checks DataSource.SEED

```solidity
uint256 score0 = oracle.getScore(token0);        // call 1
if (score0 < trustThreshold) revert ...;
if (oracle.getDataSource(token0) == DataSource.SEED) revert ...;  // call 2
```

Between these two calls, an UPDATER_ROLE could theoretically update the token's score data (changing the DataSource). In theory:
1. getScore() returns score=80 (DataSource=VERIFIED) → passes threshold check
2. Oracle updated: score=80, DataSource=SEED
3. getDataSource() returns SEED → reverts with SeedScoreRejected

While this would *block* not *allow* a swap, it's still a TOCTOU race. Conversely:
1. getScore() → token has DataSource.SEED, but since score > 0 and not stale, returns score
2. Oracle updated: DataSource changed from SEED to VERIFIED
3. getDataSource() returns VERIFIED → passes

Wait — actually the more dangerous direction: getScore() could return data from a state snapshot, then the state changes before getDataSource(). Read both in one call to avoid this.

#### Recommendation

Add a combined getter to TrustScoreOracle:

```solidity
function getScoreAndSource(address token) 
    external view returns (uint256 score, DataSource source) 
{
    TokenScore memory ts = tokenScores[token];
    if (ts.lastUpdated == 0) return (0, DataSource.NONE);
    if (block.timestamp - ts.lastUpdated > SCORE_MAX_AGE) {
        revert TrustScoreOracle__StaleScore(token, ts.lastUpdated, SCORE_MAX_AGE);
    }
    return (ts.trustScore, ts.dataSource);
}
```

Use this single-call getter in `beforeSwap` to atomically read both values from the same storage snapshot.

---

### MAIAT-008 — `batchUpdateTokenScores` Forces Single DataSource Across Entire Batch

**Severity:** 🔵 Low  
**Location:** `src/TrustScoreOracle.sol` — `batchUpdateTokenScores()` (line 163)  
**Status:** Open

#### Description

The batch update function accepts a single `DataSource` parameter applied to all tokens in the batch:

```solidity
function batchUpdateTokenScores(
    address[] calldata tokens,
    uint256[] calldata scores,
    uint256[] calldata reviewCounts,
    uint256[] calldata avgRatings,
    DataSource dataSource    // ← single value for ALL tokens
)
```

In practice, a batch update may include tokens from different sources (e.g., some community-reviewed = `COMMUNITY`, others AI-scored = `API`). Using a single DataSource forces all tokens into the same category or requires multiple batch calls.

#### Recommendation

Accept a `DataSource[] calldata dataSources` array, same as the other arrays:

```solidity
function batchUpdateTokenScores(
    address[] calldata tokens,
    uint256[] calldata scores,
    uint256[] calldata reviewCounts,
    uint256[] calldata avgRatings,
    DataSource[] calldata dataSources  // ← per-token
)
```

Note: this will also require updating `MaiatTrustConsumer`'s interface (already broken per MAIAT-001, so fix together).

---

### MAIAT-009 — Broken `@openzeppelin/` Remapping

**Severity:** 🔵 Low  
**Location:** `remappings.txt` (line 2)  
**Status:** Open — partially mitigated by workaround needed

#### Description

The `@openzeppelin/` remapping points to an empty directory:

```
# remappings.txt
@openzeppelin/=lib/v4-core/lib/openzeppelin-contracts/   ← points to empty dir
```

```bash
$ ls lib/v4-core/lib/openzeppelin-contracts/
# empty — only . and ..
```

`ScarabToken.sol` uses `@openzeppelin/contracts/...` imports. With this broken remapping, `ScarabToken.sol` fails to compile in a clean environment. The fix requires manually editing `remappings.txt`:

```
@openzeppelin/=lib/openzeppelin-contracts/   # correct
```

This was confirmed by the audit: the fix was applied before tests could run, and all tests passed after the fix.

#### Impact

CI/CD pipelines, new contributors, and deployment scripts will fail to compile without this manual fix.

#### Recommendation

Fix `remappings.txt` immediately and add a CI compilation check.

---

### MAIAT-010 — SCORE_MAX_AGE = 7 Days Is Excessively Long

**Severity:** ℹ️ Informational  
**Location:** `src/TrustScoreOracle.sol` — line 52  

#### Description

A 7-day score freshness window means tokens with scores set 6.9 days ago are still considered valid. In DeFi, 7 days is a long time — projects can rug, delist, or have fundamental changes. A score given to a legitimate project on Day 1 may be invalid by Day 7.

#### Recommendation

Consider a shorter window (24–48 hours) or make `SCORE_MAX_AGE` a configurable parameter (admin-settable within bounds).

---

### MAIAT-011 — `adminBurn` Allows Owner to Burn Any User's ScarabToken Balance

**Severity:** ℹ️ Informational  
**Location:** `src/ScarabToken.sol` — `adminBurn()` (line 29)  

#### Description

```solidity
function adminBurn(address from, uint256 amount) external onlyOwner {
    _burn(from, amount);
}
```

The owner can burn tokens from any address without the holder's approval. This is a centralization risk and could be used to punish or effectively penalize users without consent. While this appears intentional (e.g., for slashing bad actors), it should be clearly documented and ideally gated behind a timelock or DAO governance.

---

### MAIAT-012 — MaiatPassport Admin Holds All Three Roles

**Severity:** ℹ️ Informational  
**Location:** `src/MaiatPassport.sol` — `constructor()`  

#### Description

```solidity
constructor(address admin) ERC721(...) {
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(MINTER_ROLE, admin);
    _grantRole(UPDATER_ROLE, admin);
}
```

The deployer/admin holds all three roles. Separation of concerns is better: a hot wallet can be the MINTER/UPDATER, while DEFAULT_ADMIN is a cold wallet or multisig.

---

### MAIAT-013 — `getHookPermissions()` Not Covered in Hook Tests

**Severity:** ℹ️ Informational  
**Location:** `src/TrustGateHook.sol`, `src/base/BaseHook.sol`  

#### Description

Test coverage for `TrustGateHook` shows 75% function coverage (3/4 functions). The uncovered function is `getHookPermissions()`. While this function is `pure` and straightforward, it defines which hook callbacks are active — incorrect permissions bits could silently disable the trust gate. Add a test asserting the exact permissions bitmap.

BaseHook stubs are at 8.33% coverage. The stub functions are intentionally `NotImplemented`, but confirming they revert when called directly would strengthen coverage.

---

## 5. Automated Tool Results

### Forge Tests

```
Ran 5 test suites: 179 tests passed, 0 failed, 0 skipped
```

All tests pass. **Note:** Tests use MockOracle, masking the Critical MAIAT-001 bug.

### Forge Coverage

| Contract | Lines | Branches | Functions |
|----------|-------|----------|-----------|
| TrustScoreOracle.sol | **100%** (49/49) | 84.62% (11/13) | **100%** (12/12) |
| TrustGateHook.sol | 92.11% (35/38) | 83.33% (10/12) | 75.00% (3/4) |
| MaiatPassport.sol | **100%** (33/33) | **100%** (3/3) | **100%** (7/7) |
| ScarabToken.sol | **100%** (25/25) | **100%** (3/3) | **100%** (6/6) |
| MaiatTrustConsumer.sol | **100%** (48/48) | **100%** (9/9) | **100%** (8/8) |
| base/BaseHook.sol | 8.33% (2/24) | 0% (0/1) | 8.33% (1/12) |

Branch coverage gaps in TrustScoreOracle:
- `getScore()`: 2 uncovered branches (likely the 0-score path when `ts.lastUpdated == 0`)
- These are low risk given the explicit invariant in the function

### Slither Static Analysis

**14 issues found.** Prioritized by relevance:

| Detector | Severity | Location | Assessment |
|----------|----------|----------|------------|
| `reentrancy-no-eth` | Medium | `MaiatTrustConsumer.onReport()` | **Real issue — CEI violation (MAIAT-003)** |
| `incorrect-equality` | Medium | `onReport: block.number ==` | False positive — intentional block replay guard |
| `incorrect-equality` | Medium | `getScore: lastUpdated == 0` | False positive — intentional sentinel value |
| `shadowing-local` | Low | `MaiatTrustConsumer.constructor._owner` | Valid — shadows `Ownable._owner`. Minor rename fix. |
| `missing-zero-check` | Low | `setExpectedWorkflowOwner` | Intentional — `address(0)` disables the check (documented) |
| `reentrancy-benign` | Low | `onReport` | Same as reentrancy-no-eth, less severe framing |
| `reentrancy-events` | Low | `onReport` | Event emitted after external call |
| `timestamp` | Low | `getScore`, `executeOracleUpdate` | Standard timestamp usage, acceptable |
| `pragma` | Info | Multiple | 8 different OZ pragma versions — from dependency mix |
| `naming-convention` | Info | `MaiatTrustConsumer` params | Minor style: `_forwarder`, `_oracle`, `_expectedWorkflowOwner` |

**Notable false positives:** The `missing-zero-check` for `setExpectedWorkflowOwner` is intentional (address(0) = skip workflow owner check). Not a bug.

---

## 6. Detailed Recommendations

### Must-Fix Before Mainnet (Blockers)

1. **MAIAT-001**: Fix `ITrustScoreOracle` interface — add `DataSource` parameter to both functions. Write integration test using real `TrustScoreOracle`. Decide the DataSource value for Chainlink-delivered scores.

2. **MAIAT-002**: Implement score update timelock (minimum 1 hour delay). The flash manipulation vector is too dangerous for a production trust gate.

3. **MAIAT-003**: Move CEI order in `onReport()` — write `lastReportBlock` before calling oracle.

### Should-Fix Before Mainnet

4. **MAIAT-004**: Implement trusted router registry for hookData user address feature. Without it, the fee tier system is economically useless.

5. **MAIAT-005**: Increase `MIN_THRESHOLD` to a meaningful floor (30+). Add timelock to `updateThreshold()`.

6. **MAIAT-009**: Fix `@openzeppelin/` remapping and add CI check.

### Nice-to-Have (Future Improvements)

7. **MAIAT-006**: Move UPDATER_ROLE to Gnosis Safe or timelocked admin.

8. **MAIAT-007**: Add `getScoreAndSource()` combined getter to eliminate TOCTOU.

9. **MAIAT-008**: Change `batchUpdateTokenScores` to accept `DataSource[]` array.

10. **MAIAT-010**: Make `SCORE_MAX_AGE` configurable (within bounds). 7 days is too long.

11. **MAIAT-011/012**: Separate roles in Passport/ScarabToken. Use cold wallet for DEFAULT_ADMIN.

12. Add integration tests that use real contract instances (not mocks) for MaiatTrustConsumer ↔ TrustScoreOracle.

---

## 7. Go/No-Go Assessment

### ⛔ NO-GO for Mainnet

**Reason:** MAIAT-001 is a Critical blocker. The Chainlink CRE → TrustScoreOracle pipeline is completely non-functional due to the interface mismatch. Deploying to mainnet with this bug means the oracle can never be updated via Chainlink. The entire value proposition of community-review-driven trust scores cannot be delivered.

Additionally, MAIAT-002 (flash score manipulation) is a High-severity issue that makes the trust gate economically attackable before other fixes are applied.

### Minimum Viable Mainnet Checklist

- [ ] MAIAT-001: Interface mismatch fixed + integration test added
- [ ] MAIAT-002: Score update timelock implemented (≥ 1 hour)
- [ ] MAIAT-003: CEI pattern fixed in `onReport()`
- [ ] MAIAT-004: Trusted router registry OR per-user fee feature disabled until implemented
- [ ] MAIAT-005: `MIN_THRESHOLD` raised to 30 (same as default) + `updateThreshold` timelock
- [ ] MAIAT-009: `@openzeppelin/` remapping fixed + CI verification
- [ ] UPDATER_ROLE held by multisig, not EOA
- [ ] Full integration test suite (real oracle, real hook, real consumer, real pool mock)

### Current State Assessment

| Category | Score |
|----------|-------|
| Code Quality | 7/10 — well-structured, good comments |
| Test Coverage | 6/10 — 100% unit but 0% integration |
| Security | 4/10 — 1 critical blocker, several high issues |
| Architecture | 7/10 — sound V4 hook design, good staleness model |
| Centralization | 3/10 — single keys control everything |

**Overall: NOT READY. Fix MAIAT-001 through MAIAT-005, add integration tests, re-audit.**

---

*Report generated by Patrick Collins — Maiat Security Auditor*  
*contact: patrick@maiat.xyz | audit tooling: Slither 0.11.x, Forge (foundry)*

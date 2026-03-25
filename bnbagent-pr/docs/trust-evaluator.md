# Trust-Based Evaluator

The `TrustBasedEvaluatorClient` is a pluggable evaluator for the
[ERC-8183 Agentic Commerce protocol](https://github.com/bnb-chain/BEPs/tree/master/BEPs/BEP-8183).
It enables **instant, seconds-level job evaluation** based on on-chain provider
trust scores — a fast alternative to the default UMA OOv3 evaluator.

---

## Why a trust-based evaluator?

| | UMA OOv3 Evaluator | TrustBased Evaluator |
|---|---|---|
| **Liveness period** | 48 h minimum | ~0 s (instant) |
| **Dispute mechanism** | DVM (token governance) | EvaluatorRegistry feedback |
| **Bond required** | Yes (ERC-20 bond token) | No |
| **Suitable for** | High-value, contentious jobs | High-frequency, trusted agents |
| **Oracle** | UMA OOv3 dispute market | Any `ITrustOracle` contract |
| **Fallback** | DVM (on-chain) | Off-chain HTTP API (hybrid mode) |

---

## Architecture

```
Provider submits job
     ↓
TrustBasedEvaluatorClient.evaluate_job(job_id)
     ↓
ITrustOracle.getTrustScore(provider_address)  ← on-chain oracle
     |                                                ↓ fallback (HYBRID mode)
     |                                        HTTP API: GET /trust/{address}
     ↓
score >= threshold?
  Yes → complete(job_id)   bytes32("trust_approved")   → payment released
  No  → reject(job_id)     bytes32("trust_too_low")    → payment refunded
     ↓
EvaluatorRegistry.recordOutcome(evaluator, approved)  ← feedback loop
```

The `agenticCommerce` address is fixed in the contract's `initialize()` call —
there's no need to pass it at evaluation time.

### EvaluatorRegistry feedback loop

Every evaluation outcome is recorded in `EvaluatorRegistry`.  This creates an
on-chain performance history for each evaluator that can be used for governance,
monitoring, or evaluator selection.

### TrustGate before-hook

`TrustGateACPHook` is a before-hook that can be registered on an ACP contract to
block low-trust providers *before* they can even create a job.  This is a
complementary mechanism to the evaluator — a first line of defence.

---

## Installation

The clients ship as part of `bnbagent-sdk`.  No extra dependencies for
`ON_CHAIN` mode.  For `HYBRID` mode the built-in `urllib` is used.

---

## Quick start

```python
from web3 import Web3
from bnbagent.apex.trust_evaluator_client import TrustBasedEvaluatorClient, OracleMode

w3 = Web3(Web3.HTTPProvider("https://bsc-dataseed.binance.org/"))

client = TrustBasedEvaluatorClient(
    web3=w3,
    contract_address="0xYourTrustBasedEvaluatorContract",
    private_key="0xYourPrivateKey",    # or use wallet_provider=
    threshold=60,                      # minimum score 0-100
    mode=OracleMode.ON_CHAIN,
)

# Evaluate a submitted job (agenticCommerce address is fixed in the contract)
result = client.evaluate_job(job_id=42)
print(f"Job {result.job_id}: {'completed ✅' if result.completed else 'rejected ❌'}")
print(f"Provider score: {result.trust_score.score}/100")
```

---

## Configuration options

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `web3` | `Web3` | required | Connected Web3 instance |
| `contract_address` | `str` | required | TrustBasedEvaluator contract address |
| `private_key` | `str \| None` | `None` | Hex private key for signing |
| `wallet_provider` | `WalletProvider \| None` | `None` | Alternative to private_key |
| `abi` | `list \| None` | `None` | Override ABI (default: bundled JSON) |
| `threshold` | `int` | `60` | Minimum score to pass [0-100] |
| `mode` | `OracleMode` | `ON_CHAIN` | `ON_CHAIN` or `HYBRID` |
| `offchain_api_url` | `str` | `https://api.maiat.xyz/trust` | Fallback API base URL |
| `offchain_api_timeout` | `int` | `5` | HTTP timeout in seconds |

### Oracle modes

**`OracleMode.ON_CHAIN`** (default)

Trust score is fetched exclusively from the `ITrustOracle` contract registered
on the evaluator via `getTrustScore(address) → uint256`.  If the oracle returns 0
for the provider, the job is rejected with `bytes32("trust_too_low")`.

**`OracleMode.HYBRID`**

On-chain oracle is tried first.  If it returns 0 (unknown provider), the client
makes a `GET {offchain_api_url}/{address}` request for an off-chain score estimate.
The API must return:

```json
{ "score": 75, "initialized": true }
```

If the HTTP call fails, the client falls back to the uninitialized on-chain
result (logged as a warning).

---

## Core methods

### `evaluate_job(job_id) → EvaluationResult`

Evaluate a submitted ERC-8183 job.  Calls `evaluate(uint256 jobId)` on-chain.
The evaluator contract resolves the ACP address from its stored `agenticCommerce`
reference — no address parameter needed.

```python
result = client.evaluate_job(job_id=42)
# EvaluationResult(job_id=42, provider="0x...", completed=True, tx_hash="0x...")
```

### `get_trust_score(address) → TrustScore`

Fetch trust score for any address without submitting a transaction.

```python
trust = client.get_trust_score("0xProviderAddress")
print(trust.score, trust.initialized, trust.source)  # 75, True, "on_chain"
```

### `is_trusted(address, threshold=None) → bool`

Quick boolean check.

```python
if client.is_trusted("0xProvider", threshold=50):
    print("Provider is trusted")
```

### `pre_check(provider) → (score, would_pass)`

Read-only simulation of the on-chain decision — no transaction cost.

```python
score, passes = client.pre_check("0xProvider")
```

### `get_registry_stats() → dict`

Query this evaluator's historical performance from the EvaluatorRegistry.

```python
stats = client.get_registry_stats()
print(stats)  # {"approved": 120, "rejected": 8, "total": 128}
```

### `set_oracle(oracle_address)` / `set_threshold(threshold)`

Owner-only configuration functions.

```python
client.set_oracle("0xNewITrustOracleAddress")
client.set_threshold(70)
```

---

## TrustGate before-hook

```python
from bnbagent.apex.trust_gate_hook_client import TrustGateACPHookClient

hook = TrustGateACPHookClient(
    web3=w3,
    contract_address="0xYourTrustGateHookContract",
    private_key=private_key,
)

# Check if a provider would pass the gate (read-only)
score, allowed = hook.check_provider("0xProviderAddress")
print(f"score={score}, allowed={allowed}")

# Read the current minimum score
min_score = hook.get_min_score()
print(f"Current gate threshold: {min_score}/100")

# Update the gate threshold (owner only)
hook.set_min_score(70)
```

---

## EvaluatorRegistry

```python
from bnbagent.apex.evaluator_registry_client import EvaluatorRegistryClient

registry = EvaluatorRegistryClient(
    web3=w3,
    contract_address="0xYourEvaluatorRegistryContract",
)

stats = registry.get_stats("0xEvaluatorAddress")
print(f"Approved: {stats.approved}")
print(f"Rejected: {stats.rejected}")
print(f"Approval rate: {stats.approval_rate:.1%}")

# Individual counters
approved = registry.get_approved_count("0xEvaluatorAddress")
rejected = registry.get_rejected_count("0xEvaluatorAddress")
```

---

## Pluggable oracle interface

Any contract implementing `ITrustOracle` works as an oracle:

```solidity
interface ITrustOracle {
    /// @return score  Trust score in [0, 100].  0 = unknown provider.
    function getTrustScore(address user) external view returns (uint256 score);
}
```

Switch the oracle via `set_oracle()` on the evaluator contract or at deploy time.
The default oracle is Maiat Protocol's on-chain trust oracle (`MaiatTrustOracle`),
which implements `ITrustOracle` and lives in the `providers/` directory.

---

## Reason codes

| Outcome | Reason bytes32 |
|---|---|
| Approved | `bytes32("trust_approved")` |
| Rejected | `bytes32("trust_too_low")` |

---

## Environment variable pattern

```python
import os
from web3 import Web3
from bnbagent.apex.trust_evaluator_client import TrustBasedEvaluatorClient, OracleMode

client = TrustBasedEvaluatorClient(
    web3=Web3(Web3.HTTPProvider(os.environ["RPC_URL"])),
    contract_address=os.environ["TRUST_EVALUATOR_ADDRESS"],
    private_key=os.environ.get("PRIVATE_KEY"),
    threshold=int(os.environ.get("TRUST_THRESHOLD", "60")),
    mode=OracleMode[os.environ.get("ORACLE_MODE", "ON_CHAIN")],
    offchain_api_url=os.environ.get("TRUST_API_URL", "https://api.maiat.xyz/trust"),
)
```

---

## Error handling

| Exception | Cause |
|---|---|
| `RuntimeError` | ABI file missing |
| `ValueError` | threshold or min_score out of [0, 100] |
| `web3.exceptions.ContractLogicError` | On-chain revert (already evaluated, not submitted, score too low) |
| `RuntimeError` | Off-chain API unreachable (HYBRID mode, logged as warning) |

---

## See also

- `examples/trust_evaluator_example.py` — end-to-end usage example
- `bnbagent/apex/evaluator_client.py` — UMA OOv3 evaluator (for comparison)
- `bnbagent/apex/trust_gate_hook_client.py` — TrustGate before-hook client
- `bnbagent/apex/evaluator_registry_client.py` — EvaluatorRegistry client
- `bnbagent/apex/abis/TrustScoreEvaluator.json` — TrustBasedEvaluator ABI
- `bnbagent/apex/abis/TrustGateACPHook.json` — TrustGateACPHook ABI
- `bnbagent/apex/abis/EvaluatorRegistry.json` — EvaluatorRegistry ABI

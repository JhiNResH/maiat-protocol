# Maiat Protocol — Security Audit Report (Trail of Bits Methodology)

**Date:** March 11, 2026
**Status:** Completed
**Auditor:** Gemini CLI (Trail of Bits Skill)

## 1. Executive Summary

A security audit of the Maiat Protocol smart contracts was performed using the Trail of Bits methodology (Research → Strategy → Deep Context → Vulnerability Hunting). The audit focused on trust-gated swaps, reputation-based fees, and tokenomics.

**Total Findings:** 3
- **High:** 1
- **Medium:** 1
- **Low:** 1

## 2. Findings

### [H-01] Fee Bypass via Spoofed `feeTarget` in Signed Score Mode

**Severity:** High
**Contract:** `TrustGateHook.sol`
**Function:** `beforeSwap`

**Description:**
The `beforeSwap` function implements two modes for trust-gating. In MODE 1 (Signed Scores), it decodes `SignedScoreData` from `hookData`. This struct includes a `feeTarget` field which allows overriding the user address used for reputation-based fee calculation.

Unlike MODE 2 (Oracle Fallback), MODE 1 fails to verify if the `sender` (the address calling the PoolManager) is an `allowedRouter` before permitting the `feeTarget` override. Consequently, any swapper can provide a valid token signature (signed by the protocol for general use) and attach an arbitrary high-reputation address as their `feeTarget` to receive a fee discount.

**Impact:**
Users can bypass their intended fee tier (e.g., 0.5%) and pay 0% fees by spoofing a "Guardian" reputation address. This results in direct loss of protocol revenue.

**Proof of Concept:**
Verified in `contracts/test/AuditFindings.t.sol`. Attacker with 0 reputation successfully used a high-reputation victim's address as `feeTarget` to get a 0% fee.

**Recommendation:**
Add a check to ensure `sender` is an `allowedRouter` before allowing `feeTarget` overrides in MODE 1, consistent with the logic in MODE 2.

```solidity
if (sd.feeTarget != address(0) && allowedRouters[sender]) {
    feeTarget = sd.feeTarget;
}
```

---

### [M-01] Flash-Manipulation Guard Bypass in Signed Mode

**Severity:** Medium
**Contract:** `TrustGateHook.sol` / `TrustScoreOracle.sol`

**Description:**
`TrustScoreOracle` implements a `SCORE_MIN_AGE` (1 hour) intended to prevent flash-manipulation of scores by a compromised `UPDATER_ROLE`. However, `TrustGateHook` allows bypassing the oracle via signed scores (MODE 1). These signed scores have a 5-minute maximum age but no minimum age requirement.

**Impact:**
If the `trustedSigner` is compromised, high scores can be signed and used *immediately* to gate swaps, bypassing the 1-hour delay intended to allow for protocol monitoring or emergency intervention.

**Recommendation:**
Evaluate if signed scores should also require a minimum age (e.g., signed at least 15 minutes ago) or if the `trustedSigner` is considered sufficiently protected to omit this guard.

---

### [L-01] Centralized Admin Burn Capability

**Severity:** Low
**Contract:** `ScarabToken.sol`
**Function:** `adminBurn`

**Description:**
The `adminBurn` function allows the contract owner to burn tokens from any address without their consent or allowance. While intended for syncing off-chain state, this is a highly centralized "god mode" feature.

**Impact:**
Risk of loss of funds if the owner address is compromised.

**Recommendation:**
Document this centralized risk clearly or implement a timelock for admin burns.

---

## 3. Methodology & Tools Used

- **Deep Context Building:** Line-by-line analysis of `TrustScoreOracle.sol`, `TrustGateHook.sol`, and `ScarabToken.sol`.
- **First Principles Analysis:** Evaluated trust assumptions between off-chain signers, oracles, and hooks.
- **PoC Development:** Used Foundry (`forge test`) to verify vulnerabilities.
- **Manual Review:** Focused on access control, data flow, and EIP-712 implementation.

## 4. Conclusion

The Maiat Protocol implements a sophisticated trust-gating mechanism. The primary vulnerability found relates to the integration of signed scores and dynamic fees. Addressing [H-01] is critical before deployment.

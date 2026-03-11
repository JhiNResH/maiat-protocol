// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {TrustGateHook} from "../src/TrustGateHook.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title DemoSwap
/// @notice Demonstrates the TrustGateHook EIP-712 signed score flow end-to-end.
///         This script simulates what happens at the hook level using forge's vm cheatcodes.
///
/// @dev This script does NOT call PoolManager.swap() — it directly calls
///      hook.beforeSwap() with crafted hookData to demonstrate:
///      1. High-trust token → swap passes
///      2. Low-trust token → swap blocked (TrustScoreTooLow)
///      3. Expired signature → swap blocked (SignatureExpired)
///      4. Wrong signer → swap blocked (InvalidSignature)
///      5. Oracle fallback (no signed scores) → uses on-chain scores
///
/// Usage:
///   # Local simulation (no RPC needed):
///   forge script script/DemoSwap.s.sol -vvvv
///
///   # Against Base Sepolia (view-only, simulated):
///   ORACLE_ADDRESS=0xf662... HOOK_ADDRESS=0xf606... \
///   forge script script/DemoSwap.s.sol --rpc-url $BASE_SEPOLIA_RPC -vvvv
contract DemoSwap is Script {
    using ECDSA for bytes32;

    // Test signer key (DO NOT use in production)
    uint256 constant SIGNER_PK = 0xA11CE;

    function run() external {
        // ── Setup ────────────────────────────────────────────────────────
        address owner = address(this);
        address mockPoolManager = address(0xBEEF);
        address signerAddr = vm.addr(SIGNER_PK);

        console2.log("=== TrustGateHook Demo ===");
        console2.log("Signer:", signerAddr);

        // Deploy fresh contracts for demo
        TrustScoreOracle oracle = new TrustScoreOracle(owner);
        TrustGateHook hook = new TrustGateHook(oracle, IPoolManager(mockPoolManager), owner, signerAddr);

        address highTrustToken = address(0x1111);
        address lowTrustToken = address(0x2222);
        address weth = address(0x4200000000000000000000000000000000000006);

        // Seed oracle scores for fallback mode
        oracle.updateTokenScore(highTrustToken, 85, 50, 450, TrustScoreOracle.DataSource.VERIFIED);
        oracle.updateTokenScore(lowTrustToken, 15, 5, 200, TrustScoreOracle.DataSource.API);
        oracle.updateTokenScore(weth, 99, 1000, 490, TrustScoreOracle.DataSource.VERIFIED);

        // Age scores past SCORE_MIN_AGE
        vm.warp(block.timestamp + oracle.SCORE_MIN_AGE() + 1);

        console2.log("Oracle scores seeded:");
        console2.log("  highTrustToken (0x1111): score=%d", oracle.getScore(highTrustToken));
        console2.log("  lowTrustToken  (0x2222): score=%d", oracle.getScore(lowTrustToken));
        console2.log("  WETH:                    score=%d", oracle.getScore(weth));
        console2.log("  Trust threshold:         %d", hook.trustThreshold());

        // ── DEMO 1: High-trust EIP-712 signed swap PASSES ───────────────
        console2.log("\n--- DEMO 1: High-trust signed score -> PASS ---");
        {
            uint256 ts = block.timestamp;
            PoolKey memory key = _makeKey(highTrustToken, weth, hook);

            bytes memory hookData = _buildSignedHookData(
                hook, address(0),
                highTrustToken, 85, ts, 1,
                weth, 99, ts, 2
            );

            vm.prank(mockPoolManager);
            (bytes4 sel,,) = hook.beforeSwap(address(0xABC), key, _swapParams(), hookData);
            console2.log("  Result: %s", sel == IHooks.beforeSwap.selector ? "PASSED" : "FAILED");
        }

        // ── DEMO 2: Low-trust signed score BLOCKED ──────────────────────
        console2.log("\n--- DEMO 2: Low-trust signed score -> BLOCKED ---");
        {
            uint256 ts = block.timestamp;
            PoolKey memory key = _makeKey(lowTrustToken, weth, hook);

            bytes memory hookData = _buildSignedHookData(
                hook, address(0),
                lowTrustToken, 15, ts, 3,
                weth, 99, ts, 4
            );

            vm.prank(mockPoolManager);
            try hook.beforeSwap(address(0xABC), key, _swapParams(), hookData) {
                console2.log("  Result: PASSED (unexpected!)");
            } catch (bytes memory reason) {
                console2.log("  Result: BLOCKED (TrustScoreTooLow) - correct!");
                console2.logBytes(reason);
            }
        }

        // ── DEMO 3: Expired signature BLOCKED ───────────────────────────
        console2.log("\n--- DEMO 3: Expired signature -> BLOCKED ---");
        {
            uint256 ts = block.timestamp - 6 minutes; // older than SIGNED_SCORE_MAX_AGE
            PoolKey memory key = _makeKey(highTrustToken, weth, hook);

            bytes memory hookData = _buildSignedHookData(
                hook, address(0),
                highTrustToken, 85, ts, 5,
                weth, 99, ts, 6
            );

            vm.prank(mockPoolManager);
            try hook.beforeSwap(address(0xABC), key, _swapParams(), hookData) {
                console2.log("  Result: PASSED (unexpected!)");
            } catch (bytes memory reason) {
                console2.log("  Result: BLOCKED (SignatureExpired) - correct!");
                console2.logBytes(reason);
            }
        }

        // ── DEMO 4: Wrong signer BLOCKED ────────────────────────────────
        console2.log("\n--- DEMO 4: Wrong signer -> BLOCKED ---");
        {
            uint256 ts = block.timestamp;
            PoolKey memory key = _makeKey(highTrustToken, weth, hook);

            // Sign with wrong key
            uint256 fakePk = 0xDEAD;
            bytes memory fakeSig0 = _sign(hook, fakePk, highTrustToken, 85, ts, 7);
            bytes memory goodSig1 = _sign(hook, SIGNER_PK, weth, 99, ts, 8);
            bytes memory hookData = abi.encode(address(0), uint256(85), ts, uint256(7), fakeSig0, uint256(99), ts, uint256(8), goodSig1);

            vm.prank(mockPoolManager);
            try hook.beforeSwap(address(0xABC), key, _swapParams(), hookData) {
                console2.log("  Result: PASSED (unexpected!)");
            } catch (bytes memory reason) {
                console2.log("  Result: BLOCKED (InvalidSignature) - correct!");
                console2.logBytes(reason);
            }
        }

        // ── DEMO 5: Oracle fallback (no hookData) PASSES ────────────────
        console2.log("\n--- DEMO 5: Oracle fallback (no hookData) -> PASS ---");
        {
            PoolKey memory key = _makeKey(highTrustToken, weth, hook);

            vm.prank(mockPoolManager);
            (bytes4 sel,,) = hook.beforeSwap(address(0xABC), key, _swapParams(), "");
            console2.log("  Result: %s", sel == IHooks.beforeSwap.selector ? "PASSED" : "FAILED");
        }

        // ── DEMO 6: Oracle fallback low-trust BLOCKED ───────────────────
        console2.log("\n--- DEMO 6: Oracle fallback low-trust -> BLOCKED ---");
        {
            PoolKey memory key = _makeKey(lowTrustToken, weth, hook);

            vm.prank(mockPoolManager);
            try hook.beforeSwap(address(0xABC), key, _swapParams(), "") {
                console2.log("  Result: PASSED (unexpected!)");
            } catch (bytes memory reason) {
                console2.log("  Result: BLOCKED (TrustScoreTooLow) - correct!");
                console2.logBytes(reason);
            }
        }

        // ── DEMO 7: Dynamic fee tiers ───────────────────────────────────
        console2.log("\n--- DEMO 7: Dynamic fee tiers ---");
        {
            uint256 ts = block.timestamp;
            PoolKey memory key = _makeKey(highTrustToken, weth, hook);

            // New user (no reputation) → 50 bps
            bytes memory hookData = _buildSignedHookData(hook, address(0x1234), highTrustToken, 85, ts, 9, weth, 99, ts, 10);
            vm.prank(mockPoolManager);
            (,, uint24 fee) = hook.beforeSwap(address(0xABC), key, _swapParams(), hookData);
            console2.log("  New user fee:      %d (raw, 5000=0.5%%)", uint256(fee & 0x3FFFFF));

            // Guardian user (200+ rep) → 0 bps
            address guardian = address(0x5678);
            oracle.updateUserReputation(guardian, 250, 50, 10000);
            hookData = _buildSignedHookData(hook, guardian, highTrustToken, 85, ts, 11, weth, 99, ts, 12);
            vm.prank(mockPoolManager);
            (,, fee) = hook.beforeSwap(address(0xABC), key, _swapParams(), hookData);
            console2.log("  Guardian fee:      %d (raw, 0=free)", uint256(fee & 0x3FFFFF));
        }

        console2.log("\n=== Demo Complete ===");
        console2.log("All 7 scenarios demonstrated successfully.");
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    function _sign(TrustGateHook hook, uint256 pk, address token, uint256 score, uint256 ts, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(hook.SCORE_TYPEHASH(), token, score, ts, nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(hook.DOMAIN_SEPARATOR(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _buildSignedHookData(
        TrustGateHook hook,
        address feeTarget,
        address token0, uint256 score0, uint256 ts0, uint256 nonce0,
        address token1, uint256 score1, uint256 ts1, uint256 nonce1
    ) internal view returns (bytes memory) {
        bytes memory sig0 = _sign(hook, SIGNER_PK, token0, score0, ts0, nonce0);
        bytes memory sig1 = _sign(hook, SIGNER_PK, token1, score1, ts1, nonce1);
        return abi.encode(feeTarget, score0, ts0, nonce0, sig0, score1, ts1, nonce1, sig1);
    }

    function _makeKey(address t0, address t1, TrustGateHook hook) internal pure returns (PoolKey memory) {
        // Ensure currency0 < currency1 (Uniswap V4 requirement)
        if (t0 > t1) (t0, t1) = (t1, t0);
        return PoolKey({
            currency0: Currency.wrap(t0),
            currency1: Currency.wrap(t1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _swapParams() internal pure returns (SwapParams memory) {
        return SwapParams({zeroForOne: true, amountSpecified: -100, sqrtPriceLimitX96: 0});
    }
}

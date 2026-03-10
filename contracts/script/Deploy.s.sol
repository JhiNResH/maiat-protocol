// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";
import {TrustGateHook} from "../src/TrustGateHook.sol";
import {MaiatPassport} from "../src/MaiatPassport.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

/// @title Deploy
/// @notice Deploys all Maiat Protocol contracts:
///         TrustScoreOracle, TrustGateHook, MaiatPassport
///
/// @dev MaiatTrustConsumer was removed (MAIAT-001): the Chainlink CRE integration had a
///      broken ITrustScoreOracle interface (function selector mismatch — DataSource param missing).
///      Since we are not using Chainlink CRE in the current architecture, the contract was deleted.
///      Trust scores are updated directly via TrustScoreOracle.updateTokenScore (UPDATER_ROLE).
///
/// Usage:
///   # Dry run (no broadcast):
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL -vvvv
///
///   # Deploy to Base Sepolia:
///   forge script script/Deploy.s.sol \
///     --rpc-url $BASE_SEPOLIA_RPC \
///     --private-key $PRIVATE_KEY \
///     --broadcast --verify \
///     --etherscan-api-key $BASESCAN_API_KEY \
///     -vvvv
///
/// Required env vars:
///   PRIVATE_KEY          — deployer private key (uint256)
///
/// Optional env vars:
///   POOL_MANAGER_ADDRESS — Uniswap V4 PoolManager (defaults to Base Sepolia)
///   TRUSTED_ROUTER       — Known trusted router to register in TrustGateHook (optional)
contract Deploy is Script {
    // Uniswap V4 PoolManager on Base Sepolia
    // https://docs.uniswap.org/contracts/v4/deployments
    address constant BASE_SEPOLIA_POOL_MANAGER = 0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address poolManagerAddr = vm.envOr("POOL_MANAGER_ADDRESS", BASE_SEPOLIA_POOL_MANAGER);
        address trustedRouter = vm.envOr("TRUSTED_ROUTER", address(0));

        console2.log("=== MAIAT Protocol Deployment ===");
        console2.log("Deployer:    ", deployer);
        console2.log("PoolManager: ", poolManagerAddr);
        console2.log("Chain ID:    ", block.chainid);

        vm.startBroadcast(deployerKey);

        // 1. Deploy TrustScoreOracle
        //    deployer = DEFAULT_ADMIN_ROLE + UPDATER_ROLE
        //    SECURITY: Transfer UPDATER_ROLE to a Gnosis Safe multisig after deployment.
        TrustScoreOracle oracle = new TrustScoreOracle(deployer);
        console2.log("TrustScoreOracle deployed:    ", address(oracle));

        // 2. Deploy TrustGateHook (Uniswap V4 hook)
        TrustGateHook hook = new TrustGateHook(oracle, IPoolManager(poolManagerAddr), deployer);
        console2.log("TrustGateHook deployed:       ", address(hook));
        console2.log("  Default trust threshold:    ", hook.trustThreshold());

        // 3. Register trusted router if provided (MAIAT-004)
        if (trustedRouter != address(0)) {
            hook.setTrustedRouter(trustedRouter, true);
            console2.log("  Trusted router registered:  ", trustedRouter);
        }

        // 4. Deploy MaiatPassport (soulbound ERC-721)
        MaiatPassport passport = new MaiatPassport(deployer);
        console2.log("MaiatPassport deployed:       ", address(passport));

        vm.stopBroadcast();

        console2.log("\n=== Deployment Summary ===");
        console2.log("TrustScoreOracle: ", address(oracle));
        console2.log("TrustGateHook:    ", address(hook));
        console2.log("MaiatPassport:    ", address(passport));
        console2.log("\nPost-deployment checklist:");
        console2.log("1. Transfer UPDATER_ROLE to a Gnosis Safe multisig (MAIAT-006)");
        console2.log("2. Register trusted routers via hook.setTrustedRouter() (MAIAT-004)");
        console2.log("3. To change threshold: proposeThreshold() -> wait 24h -> executeThreshold() (MAIAT-005)");
        console2.log("4. Seed initial token scores via oracle.updateTokenScore() or emergencyUpdateTokenScore()");
    }
}

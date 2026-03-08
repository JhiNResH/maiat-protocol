// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";
import {TrustGateHook} from "../src/TrustGateHook.sol";
import {MaiatPassport} from "../src/MaiatPassport.sol";
import {MaiatTrustConsumer} from "../src/MaiatTrustConsumer.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

/// @title Deploy
/// @notice Deploys all Maiat Protocol contracts:
///         TrustScoreOracle, TrustGateHook, MaiatPassport, MaiatTrustConsumer
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
///   POOL_MANAGER_ADDRESS         — Uniswap V4 PoolManager (defaults to Base Sepolia)
///   FORWARDER_ADDRESS            — Chainlink KeystoneForwarder address
///   EXPECTED_WORKFLOW_OWNER      — CRE workflow owner for MaiatTrustConsumer (default: deployer)
contract Deploy is Script {
    // Uniswap V4 PoolManager on Base Sepolia
    // https://docs.uniswap.org/contracts/v4/deployments
    address constant BASE_SEPOLIA_POOL_MANAGER = 0x7Da1D65F8B249183667cdE74C5CBD46dD38AA829;

    // Placeholder forwarder — replace with actual Chainlink KeystoneForwarder on target chain
    address constant PLACEHOLDER_FORWARDER = address(0x1);

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        address poolManagerAddr = vm.envOr("POOL_MANAGER_ADDRESS", BASE_SEPOLIA_POOL_MANAGER);
        address forwarderAddr   = vm.envOr("FORWARDER_ADDRESS",    PLACEHOLDER_FORWARDER);
        address workflowOwner   = vm.envOr("EXPECTED_WORKFLOW_OWNER", deployer);

        console2.log("=== MAIAT Protocol Deployment ===");
        console2.log("Deployer:              ", deployer);
        console2.log("PoolManager:           ", poolManagerAddr);
        console2.log("Forwarder:             ", forwarderAddr);
        console2.log("ExpectedWorkflowOwner: ", workflowOwner);
        console2.log("Chain ID:              ", block.chainid);

        vm.startBroadcast(deployerKey);

        // 1. Deploy TrustScoreOracle
        //    deployer = admin + updater (can update scores directly)
        TrustScoreOracle oracle = new TrustScoreOracle(deployer);
        console2.log("TrustScoreOracle deployed:    ", address(oracle));

        // 2. Deploy TrustGateHook (Uniswap V4 hook)
        TrustGateHook hook = new TrustGateHook(
            oracle,
            IPoolManager(poolManagerAddr),
            deployer
        );
        console2.log("TrustGateHook deployed:       ", address(hook));
        console2.log("  Default trust threshold:    ", hook.trustThreshold());

        // 3. Deploy MaiatPassport (soulbound ERC-721)
        MaiatPassport passport = new MaiatPassport(deployer);
        console2.log("MaiatPassport deployed:       ", address(passport));

        // 4. Deploy MaiatTrustConsumer (Chainlink CRE receiver)
        //    oracle is passed — the consumer will call oracle.batchUpdateTokenScores
        //    NOTE: consumer's internal interface omits DataSource param
        MaiatTrustConsumer consumer = new MaiatTrustConsumer(
            forwarderAddr,
            address(oracle),
            deployer,
            workflowOwner
        );
        console2.log("MaiatTrustConsumer deployed:  ", address(consumer));

        // 5. Grant UPDATER_ROLE on TrustScoreOracle to MaiatTrustConsumer
        //    so it can batch-update scores when a Chainlink report arrives.
        //    NOTE: This will revert at runtime because TrustScoreOracle.batchUpdateTokenScores
        //    takes a DataSource param but the consumer's interface does not.
        //    This grant is included for completeness; adapt the interface before production use.
        oracle.grantRole(oracle.UPDATER_ROLE(), address(consumer));
        console2.log("  Granted UPDATER_ROLE -> MaiatTrustConsumer");

        vm.stopBroadcast();

        console2.log("\n=== Deployment Summary ===");
        console2.log("TrustScoreOracle:   ", address(oracle));
        console2.log("TrustGateHook:      ", address(hook));
        console2.log("MaiatPassport:      ", address(passport));
        console2.log("MaiatTrustConsumer: ", address(consumer));
        console2.log("\nNext steps:");
        console2.log("1. Export ORACLE_ADDRESS=", address(oracle));
        console2.log("2. Run SeedScores script to populate token trust scores");
        console2.log("3. Configure real Chainlink KeystoneForwarder in MaiatTrustConsumer");
    }
}

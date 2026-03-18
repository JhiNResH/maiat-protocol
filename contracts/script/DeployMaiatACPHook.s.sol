// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @title DeployMaiatACPHook
 * @notice Deploy script for MaiatACPHook (ERC-8183 IACPHook).
 * @dev Usage:
 *   forge script script/DeployMaiatACPHook.s.sol:DeployMaiatACPHook \
 *     --rpc-url $BASE_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 *   Required env vars:
 *     DEPLOYER_PRIVATE_KEY — deployer wallet (DO NOT hardcode)
 *     ORACLE_ADDRESS       — TrustScoreOracle address (e.g., 0xc6cf...c6da on Base)
 *     ACP_CONTRACT_ADDRESS — AgenticCommerce contract address
 *     ADMIN_ADDRESS        — admin/owner address (separate from deployer)
 *
 *   Optional env vars:
 *     CLIENT_THRESHOLD     — minimum client trust score (default: 30)
 *     PROVIDER_THRESHOLD   — minimum provider trust score (default: 20)
 *     ALLOW_UNINITIALIZED  — allow new agents with no history (default: true)
 *
 * ⚠️ IMPORTANT: Get an audit before deploying to mainnet!
 *    This contract has been reviewed but NOT formally audited by a third party.
 */

import {Script, console2} from "forge-std/Script.sol";
import {MaiatACPHook} from "../src/MaiatACPHook.sol";

contract DeployMaiatACPHook is Script {
    function run() external {
        // --- Config ---
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address acpContractAddress = vm.envAddress("ACP_CONTRACT_ADDRESS");
        address adminAddress = vm.envAddress("ADMIN_ADDRESS");

        uint256 clientThreshold = vm.envOr("CLIENT_THRESHOLD", uint256(30));
        uint256 providerThreshold = vm.envOr("PROVIDER_THRESHOLD", uint256(20));
        bool allowUninitialized = vm.envOr("ALLOW_UNINITIALIZED", true);

        // --- Validation ---
        require(oracleAddress != address(0), "ORACLE_ADDRESS required");
        require(acpContractAddress != address(0), "ACP_CONTRACT_ADDRESS required");
        require(adminAddress != address(0), "ADMIN_ADDRESS required");
        require(clientThreshold <= 100, "CLIENT_THRESHOLD must be <= 100");
        require(providerThreshold <= 100, "PROVIDER_THRESHOLD must be <= 100");

        console2.log("=== Deploying MaiatACPHook ===");
        console2.log("Oracle:", oracleAddress);
        console2.log("ACP Contract:", acpContractAddress);
        console2.log("Admin:", adminAddress);
        console2.log("Client Threshold:", clientThreshold);
        console2.log("Provider Threshold:", providerThreshold);
        console2.log("Allow Uninitialized:", allowUninitialized);

        // --- Deploy ---
        vm.startBroadcast(deployerKey);

        MaiatACPHook hook = new MaiatACPHook(
            oracleAddress,
            acpContractAddress,
            clientThreshold,
            providerThreshold,
            allowUninitialized,
            adminAddress // owner is admin, NOT deployer
        );

        vm.stopBroadcast();

        console2.log("=== Deployed ===");
        console2.log("MaiatACPHook:", address(hook));
        console2.log("Owner:", hook.owner());
        console2.log("");
        console2.log("NEXT STEPS:");
        console2.log("1. Whitelist this hook on AgenticCommerce:");
        console2.log("   AgenticCommerce.setHookWhitelist(", address(hook), ", true)");
        console2.log("2. Verify on Basescan:");
        console2.log("   forge verify-contract", address(hook), "MaiatACPHook --chain base");
    }
}

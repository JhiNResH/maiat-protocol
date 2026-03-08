// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";

/// @title SeedScores
/// @notice Seeds 5 example token trust scores via batchUpdateTokenScores
///
/// Usage:
///   forge script script/SeedScores.s.sol \
///     --rpc-url $RPC_URL \
///     --private-key $PRIVATE_KEY \
///     --broadcast \
///     -vvvv
///
/// Required env vars:
///   ORACLE_ADDRESS — Deployed TrustScoreOracle address
///   PRIVATE_KEY    — Private key of an account with UPDATER_ROLE (uint256)
///
/// Example tokens (REPLACE with real token addresses for production):
///   TOKEN_0 — WETH (placeholder)
///   TOKEN_1 — USDC (placeholder)
///   TOKEN_2 — cbBTC (placeholder)
///   TOKEN_3 — AERO (placeholder)
///   TOKEN_4 — DEGEN (placeholder)
contract SeedScores is Script {
    // Placeholder token addresses — replace with real on-chain addresses
    address constant PLACEHOLDER_WETH  = 0x4200000000000000000000000000000000000006;
    address constant PLACEHOLDER_USDC  = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant PLACEHOLDER_cbBTC = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;
    address constant PLACEHOLDER_AERO  = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;
    address constant PLACEHOLDER_DEGEN = 0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed;

    function run() external {
        address oracleAddr = vm.envAddress("ORACLE_ADDRESS");
        uint256 updaterKey = vm.envUint("PRIVATE_KEY");
        address updater    = vm.addr(updaterKey);

        TrustScoreOracle oracle = TrustScoreOracle(oracleAddr);

        // Verify the updater has the role
        bool hasRole = oracle.hasRole(oracle.UPDATER_ROLE(), updater);

        console2.log("=== SeedScores ===");
        console2.log("Oracle:   ", oracleAddr);
        console2.log("Updater:  ", updater);
        console2.log("Has UPDATER_ROLE:", hasRole);

        if (!hasRole) {
            console2.log("WARNING: updater does NOT have UPDATER_ROLE - tx will revert");
        }

        // Build batch arrays (5 example tokens)
        address[] memory tokens      = new address[](5);
        uint256[] memory scores      = new uint256[](5);
        uint256[] memory reviewCounts = new uint256[](5);
        uint256[] memory avgRatings  = new uint256[](5);

        // TOKEN_0: WETH — highly trusted, many reviews, high rating
        tokens[0]       = vm.envOr("TOKEN_0", PLACEHOLDER_WETH);
        scores[0]       = 95;
        reviewCounts[0] = 1000;
        avgRatings[0]   = 490; // 4.9 stars

        // TOKEN_1: USDC — very high trust, stablecoin
        tokens[1]       = vm.envOr("TOKEN_1", PLACEHOLDER_USDC);
        scores[1]       = 98;
        reviewCounts[1] = 2000;
        avgRatings[1]   = 495; // 4.95 stars

        // TOKEN_2: cbBTC — high trust, Bitcoin wrapper on Base
        tokens[2]       = vm.envOr("TOKEN_2", PLACEHOLDER_cbBTC);
        scores[2]       = 90;
        reviewCounts[2] = 500;
        avgRatings[2]   = 470; // 4.7 stars

        // TOKEN_3: AERO — moderate trust, established DEX token
        tokens[3]       = vm.envOr("TOKEN_3", PLACEHOLDER_AERO);
        scores[3]       = 72;
        reviewCounts[3] = 300;
        avgRatings[3]   = 420; // 4.2 stars

        // TOKEN_4: DEGEN — lower trust, newer/meme token
        tokens[4]       = vm.envOr("TOKEN_4", PLACEHOLDER_DEGEN);
        scores[4]       = 45;
        reviewCounts[4] = 150;
        avgRatings[4]   = 350; // 3.5 stars

        console2.log("\n=== Seeding 5 token scores ===");
        for (uint256 i = 0; i < tokens.length; i++) {
            console2.log("Token[%d]: %s -> score=%d", i, tokens[i], scores[i]);
        }

        vm.startBroadcast(updaterKey);

        oracle.batchUpdateTokenScores(
            tokens,
            scores,
            reviewCounts,
            avgRatings,
            TrustScoreOracle.DataSource.COMMUNITY
        );

        vm.stopBroadcast();

        console2.log("\n=== Seed Complete ===");
        for (uint256 i = 0; i < tokens.length; i++) {
            console2.log("  Seeded token %s with score %d", tokens[i], scores[i]);
        }
    }
}

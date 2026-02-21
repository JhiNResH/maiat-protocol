// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {TrustScoreOracle} from "../src/TrustScoreOracle.sol";
import {TrustGateHook} from "../src/TrustGateHook.sol";

/// @title Interact
/// @notice Post-deployment scripts for managing oracle scores and hook config
///
/// Usage:
///   # Seed initial token scores (owner only):
///   ORACLE_ADDRESS=0x... forge script script/Interact.s.sol:SeedScores \
///     --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast -vvvv
///
///   # Update a single token score:
///   TOKEN=0x... SCORE=85 REVIEW_COUNT=12 AVG_RATING=440 \
///   forge script script/Interact.s.sol:UpdateTokenScore \
///     --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast -vvvv
///
///   # Update user reputation:
///   USER=0x... REP_SCORE=75 TOTAL_REVIEWS=10 SCARAB=1000 \
///   forge script script/Interact.s.sol:UpdateUserRep \
///     --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast -vvvv
///
///   # Update trust threshold:
///   HOOK_ADDRESS=0x... NEW_THRESHOLD=70 \
///   forge script script/Interact.s.sol:UpdateThreshold \
///     --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY --broadcast -vvvv
///
///   # Read current state (no broadcast needed):
///   ORACLE_ADDRESS=0x... HOOK_ADDRESS=0x... \
///   forge script script/Interact.s.sol:ReadState --rpc-url $BASE_SEPOLIA_RPC -vvvv

// ─── Seed initial token scores ──────────────────────────────────────────────

contract SeedScores is Script {
    function run() external {
        address oracleAddr = vm.envAddress("ORACLE_ADDRESS");
        uint256 callerKey = vm.envUint("PRIVATE_KEY");

        TrustScoreOracle oracle = TrustScoreOracle(oracleAddr);

        // Base Sepolia token addresses
        address WETH = 0x4200000000000000000000000000000000000006;
        address USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        address DAI  = 0x7683022d84F726a96c4A6611cD31DBf5409c0Ac9;

        address[] memory tokens        = new address[](3);
        uint256[] memory scores        = new uint256[](3);
        uint256[] memory reviewCounts  = new uint256[](3);
        uint256[] memory avgRatings    = new uint256[](3);

        // WETH: score 95, 150 reviews, avg 4.8 (480)
        tokens[0] = WETH; scores[0] = 95; reviewCounts[0] = 150; avgRatings[0] = 480;
        // USDC: score 92, 200 reviews, avg 4.7 (470)
        tokens[1] = USDC; scores[1] = 92; reviewCounts[1] = 200; avgRatings[1] = 470;
        // DAI:  score 88,  80 reviews, avg 4.5 (450)
        tokens[2] = DAI;  scores[2] = 88; reviewCounts[2] =  80; avgRatings[2] = 450;

        console2.log("Seeding scores on oracle:", oracleAddr);
        console2.log("Caller:", vm.addr(callerKey));

        vm.startBroadcast(callerKey);
        oracle.batchUpdateTokenScores(tokens, scores, reviewCounts, avgRatings);
        vm.stopBroadcast();

        console2.log("Scores seeded:");
        console2.log("  WETH:", oracle.getScore(WETH));
        console2.log("  USDC:", oracle.getScore(USDC));
        console2.log("  DAI: ", oracle.getScore(DAI));
    }
}

// ─── Update single token score ──────────────────────────────────────────────

contract UpdateTokenScore is Script {
    function run() external {
        address oracleAddr   = vm.envAddress("ORACLE_ADDRESS");
        address token        = vm.envAddress("TOKEN");
        uint256 score        = vm.envUint("SCORE");
        uint256 reviewCount  = vm.envUint("REVIEW_COUNT");
        uint256 avgRating    = vm.envUint("AVG_RATING"); // e.g. 450 = 4.5 stars
        uint256 callerKey    = vm.envUint("PRIVATE_KEY");

        TrustScoreOracle oracle = TrustScoreOracle(oracleAddr);

        console2.log("Updating score for token:", token);
        console2.log("  score:", score);
        console2.log("  reviews:", reviewCount);
        console2.log("  avgRating:", avgRating);

        vm.startBroadcast(callerKey);
        oracle.updateTokenScore(token, score, reviewCount, avgRating);
        vm.stopBroadcast();

        console2.log("Updated. New score:", oracle.getScore(token));
    }
}

// ─── Update user reputation ─────────────────────────────────────────────────

contract UpdateUserRep is Script {
    function run() external {
        address oracleAddr    = vm.envAddress("ORACLE_ADDRESS");
        address user          = vm.envAddress("USER");
        uint256 repScore      = vm.envUint("REP_SCORE");
        uint256 totalReviews  = vm.envUint("TOTAL_REVIEWS");
        uint256 scarabPoints  = vm.envUint("SCARAB");
        uint256 callerKey     = vm.envUint("PRIVATE_KEY");

        TrustScoreOracle oracle = TrustScoreOracle(oracleAddr);

        console2.log("Updating reputation for user:", user);
        console2.log("  repScore:", repScore);
        console2.log("  reviews:", totalReviews);
        console2.log("  scarab:", scarabPoints);

        vm.startBroadcast(callerKey);
        oracle.updateUserReputation(user, repScore, totalReviews, scarabPoints);
        vm.stopBroadcast();

        TrustScoreOracle.UserReputation memory rep = oracle.getUserData(user);
        console2.log("Updated. FeeBps:", rep.feeBps, "(50=0.5%, 30=0.3%, 10=0.1%, 0=free)");
    }
}

// ─── Update trust threshold ─────────────────────────────────────────────────

contract UpdateThreshold is Script {
    function run() external {
        address hookAddr      = vm.envAddress("HOOK_ADDRESS");
        uint256 newThreshold  = vm.envUint("NEW_THRESHOLD");
        uint256 callerKey     = vm.envUint("PRIVATE_KEY");

        TrustGateHook hook = TrustGateHook(hookAddr);

        console2.log("Hook:", hookAddr);
        console2.log("Old threshold:", hook.trustThreshold());

        vm.startBroadcast(callerKey);
        hook.updateThreshold(newThreshold);
        vm.stopBroadcast();

        console2.log("New threshold:", hook.trustThreshold());
    }
}

// ─── Read current state (view only) ─────────────────────────────────────────

contract ReadState is Script {
    function run() external view {
        address oracleAddr = vm.envAddress("ORACLE_ADDRESS");
        address hookAddr   = vm.envAddress("HOOK_ADDRESS");

        TrustScoreOracle oracle = TrustScoreOracle(oracleAddr);
        TrustGateHook    hook   = TrustGateHook(hookAddr);

        address WETH = 0x4200000000000000000000000000000000000006;
        address USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        address DAI  = 0x7683022d84F726a96c4A6611cD31DBf5409c0Ac9;

        console2.log("=== MAIAT On-chain State ===");
        console2.log("Oracle:          ", oracleAddr);
        console2.log("Hook:            ", hookAddr);
        console2.log("Trust Threshold: ", hook.trustThreshold());
        console2.log("Oracle on Hook:  ", address(hook.oracle()));
        console2.log("Fee Tiers:");
        console2.log("  BASE:     ", oracle.BASE_FEE(), "bps");
        console2.log("  TRUSTED:  ", oracle.TRUSTED_FEE(), "bps");
        console2.log("  VERIFIED: ", oracle.VERIFIED_FEE(), "bps");
        console2.log("  GUARDIAN: ", oracle.GUARDIAN_FEE(), "bps");
        console2.log("\n--- Token Scores ---");
        console2.log("WETH score:", oracle.getScore(WETH));
        console2.log("USDC score:", oracle.getScore(USDC));
        console2.log("DAI  score:", oracle.getScore(DAI));
    }
}

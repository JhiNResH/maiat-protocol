// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MaiatEvaluator} from "../src/acp/MaiatEvaluator.sol";

/// @title DeployMaiatEvaluator
/// @notice Deploys MaiatEvaluator to Base Sepolia or Base Mainnet
contract DeployMaiatEvaluator is Script {
    // Base Sepolia
    address constant ORACLE_SEPOLIA = 0xF662902ca227BabA3a4d11A1Bc58073e0B0d1139;

    // Base Mainnet (MaiatOracle — use when deploying to mainnet)
    address constant ORACLE_MAINNET = 0xC6cF2d59fF2e4EE64bbfcEaad8Dcb9aA3F13c6dA;

    uint256 constant DEFAULT_THRESHOLD = 30;
    uint256 constant DEFAULT_THREAT_THRESHOLD = 3;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Auto-detect network
        address oracleAddr;
        string memory network;
        if (block.chainid == 84532) {
            oracleAddr = ORACLE_SEPOLIA;
            network = "Base Sepolia";
        } else if (block.chainid == 8453) {
            oracleAddr = ORACLE_MAINNET;
            network = "Base Mainnet";
        } else {
            revert("Unsupported chain");
        }

        console2.log("Deploying MaiatEvaluator on", network);
        console2.log("  Oracle:", oracleAddr);
        console2.log("  Threshold:", DEFAULT_THRESHOLD);
        console2.log("  Threat Threshold:", DEFAULT_THREAT_THRESHOLD);
        console2.log("  Owner:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        MaiatEvaluator evaluator = new MaiatEvaluator(
            oracleAddr,
            DEFAULT_THRESHOLD,
            DEFAULT_THREAT_THRESHOLD,
            deployer
        );

        console2.log("  MaiatEvaluator deployed at:", address(evaluator));

        vm.stopBroadcast();
    }
}

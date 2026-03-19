// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/token/ScarabToken.sol";

contract DeployScarab is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerKey);

        ScarabToken token = new ScarabToken();

        console.log("ScarabToken deployed at:", address(token));
        console.log("Owner:", token.owner());
        console.log("Tax:", token.transferTaxBps(), "bps");

        vm.stopBroadcast();
    }
}

contract BatchMint is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address tokenAddr = vm.envAddress("SCARAB_TOKEN");

        ScarabToken token = ScarabToken(tokenAddr);

        console.log("Batch minting Scarab rewards...");
        console.log("Token:", tokenAddr);
        console.log("Owner:", token.owner());

        vm.startBroadcast(deployerKey);

        // Example batch mint — replace with actual DB-sourced data
        // token.mint(0xRecipient1, 100e18);
        // token.mint(0xRecipient2, 50e18);

        vm.stopBroadcast();

        console.log("Batch mint complete");
    }
}

contract SetTax is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address tokenAddr = vm.envAddress("SCARAB_TOKEN");
        uint256 newTaxBps = vm.envUint("NEW_TAX_BPS");

        ScarabToken token = ScarabToken(tokenAddr);

        console.log("Current tax:", token.transferTaxBps(), "bps");
        console.log("New tax:", newTaxBps, "bps");

        vm.startBroadcast(deployerKey);
        token.setTransferTax(newTaxBps);
        vm.stopBroadcast();

        console.log("Tax updated to:", token.transferTaxBps(), "bps");
    }
}

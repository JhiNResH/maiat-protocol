// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/maiat/SkillRegistry.sol";
import "../src/maiat/ReputationEngine.sol";
import "../src/maiat/JobMarket.sol";

contract DeployXLayer is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy SkillRegistry
        SkillRegistry skillRegistry = new SkillRegistry();
        console.log("SkillRegistry:", address(skillRegistry));

        // 2. Deploy ReputationEngine
        ReputationEngine reputationEngine = new ReputationEngine();
        console.log("ReputationEngine:", address(reputationEngine));

        // 3. Deploy JobMarket (needs both addresses)
        JobMarket jobMarket = new JobMarket(address(reputationEngine), address(skillRegistry));
        console.log("JobMarket:", address(jobMarket));

        // 4. Authorize JobMarket to update reputation
        reputationEngine.setAuthorizedCaller(address(jobMarket), true);
        console.log("JobMarket authorized on ReputationEngine");

        // 5. Seed demo skills
        skillRegistry.createSkill("Food Delivery", "Navigate and deliver food orders efficiently", 0.001 ether, "");
        skillRegistry.createSkill("DEX Swap Pro", "Execute optimal token swaps with minimal slippage", 0.002 ether, "");
        skillRegistry.createSkill("Ride Dispatch", "Coordinate ride pickups and dropoffs", 0.001 ether, "");
        skillRegistry.createSkill("Staking Optimizer", "Manage staking positions for maximum yield", 0.003 ether, "");
        skillRegistry.createSkill("Customer Support", "Handle user inquiries and resolve issues", 0.0005 ether, "");
        console.log("5 demo skills created");

        vm.stopBroadcast();
    }
}

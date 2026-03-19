// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {AgentIdentity} from "../src/identity/AgentIdentity.sol";

contract DeployAgentIdentity is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("MAIAT_ADMIN_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console.log("Deployer / owner:", deployer);

        vm.startBroadcast(deployerKey);
        AgentIdentity id = new AgentIdentity(deployer);
        vm.stopBroadcast();

        console.log("AgentIdentity deployed at:", address(id));
    }
}

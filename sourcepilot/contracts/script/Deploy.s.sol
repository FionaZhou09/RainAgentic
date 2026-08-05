// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Hello} from "../src/Hello.sol";

/// @notice WP0 environment check: deploy Hello to Monad testnet (chain 10143)
/// to prove the Foundry -> RPC -> testnet path works before WP3 depends on it.
contract DeployHello is Script {
    function run() external returns (Hello) {
        vm.startBroadcast();
        Hello hello = new Hello("SourcePilot AI");
        vm.stopBroadcast();

        console.log("Hello deployed at:", address(hello));
        return hello;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";

/**
 * Deploys MandateRegistry to Monad testnet (chain 10143).
 *
 * ⚠ HOLD: not to be run until the manager confirms the agent key is funded. Every test in
 *   MandateRegistry.t.sol runs against forge's local EVM and needs no funding; only this
 *   needs MON.
 *
 * ⚠ THE DEPLOYED ADDRESS BECOMES PART OF EVERY FUTURE DIGEST. `verifyingContract` is inside
 *   the EIP-712 domain separator, so the live demo mandate must be signed against THIS
 *   address, not the fixture's 0x5FbDB2...aa3. The fixture address exists only so Foundry
 *   can reproduce a digest TypeScript computed independently; it is not a deploy target.
 *
 * ⚠ THE LIVE MANDATE IS SIGNED BY THE DEMO PRINCIPAL (0x214B1e3E...29c6 from
 *   .env.secrets.local), NOT by the fixture principal (anvil #0). Two different keys,
 *   deliberately. Conflating them makes create() reject a valid signature.
 *
 * Run (only once funding is confirmed):
 *   forge script script/Deploy.s.sol:DeployMandateRegistry \
 *     --rpc-url monad_testnet --broadcast
 * with DEPLOYER_PRIVATE_KEY exported from sourcepilot/.env.secrets.local.
 */
contract DeployMandateRegistry is Script {
    function run() external returns (MandateRegistry registry) {
        vm.startBroadcast();
        registry = new MandateRegistry();
        vm.stopBroadcast();

        console.log("MandateRegistry deployed at:", address(registry));
        console.log("chainId:", block.chainid);
        console.log("Record this address and its explorer link in output/monad/deployment.json.");
        console.log("The live mandate MUST be re-signed against this address.");
    }
}

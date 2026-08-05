// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice WP0 environment check only. Not part of the mandate/registry surface
/// in INTERFACE-CONTRACTS.md §5 — this exists to prove Foundry deploys to Monad
/// testnet before any downstream package depends on that working.
contract Hello {
    string public greeting;

    constructor(string memory _greeting) {
        greeting = _greeting;
    }
}

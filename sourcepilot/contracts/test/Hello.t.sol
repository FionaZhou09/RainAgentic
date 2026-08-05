// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Hello} from "../src/Hello.sol";

contract HelloTest is Test {
    function test_greetingIsSetAtDeploy() public {
        Hello hello = new Hello("SourcePilot AI");
        assertEq(hello.greeting(), "SourcePilot AI");
    }
}

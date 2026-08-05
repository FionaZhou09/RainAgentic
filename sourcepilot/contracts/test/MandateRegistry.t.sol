// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MandateRegistry} from "../src/MandateRegistry.sol";
import {IMandateRegistry} from "../src/IMandateRegistry.sol";

/**
 * ============================================================================
 * ⚠ THE DIGEST IS BOUND TO **BOTH** THE PRINCIPAL ADDRESS AND THE REGISTRY
 *   ADDRESS. NEITHER MAY DRIFT.
 * ============================================================================
 *
 * 1. TWO PRINCIPALS EXIST, DELIBERATELY.
 *
 *    - The FIXTURE principal is anvil key #0 -> 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266.
 *      digest-vector.json is signed by it. It is public and reproducible, so a judge can
 *      verify the vector from a clean checkout with nothing gitignored.
 *    - The LIVE DEMO principal is 0x214B1e3E38453582Ea1d078c080ec1781C5c29c6, from
 *      .env.secrets.local. It holds revocation authority and is the key on stage.
 *
 *    EVERY TEST IN THIS FILE ASSERTS AGAINST THE FIXTURE PRINCIPAL. Anything touching the
 *    live mandate uses the .env one. Conflate them and create() rejects a perfectly valid
 *    signature, which presents as broken digest or encoding logic when nothing is wrong
 *    with either.
 *
 * 2. `verifyingContract` IS INSIDE THE EIP-712 DOMAIN SEPARATOR.
 *
 *    The digest is bound to the registry address exactly as it is bound to the principal.
 *    A freshly `new`-ed registry lands at a different address and the cross-language pin
 *    fails for a reason that has nothing to do with encoding. So we `deployCodeTo` the
 *    registry at the vector's pinned address (0x5FbDB2315678afecb367f032d93F642f64180aa3)
 *    rather than regenerate the vector — regenerating would make the pin tautological,
 *    since both sides would then derive from the same run. The entire value of this test
 *    is that TypeScript produced that digest yesterday and Solidity reproduces it
 *    independently today.
 *
 * 3. chainId is likewise in the domain. viem hardcodes 10143 (Monad testnet), so setUp
 *    does vm.chainId(10143). Forge's default 31337 would silently change every digest.
 */
contract MandateRegistryTest is Test {
    MandateRegistry internal registry;

    /// Pinned by digest-vector.json. Do not change without regenerating the vector.
    address internal constant VECTOR_REGISTRY = 0x5FbDB2315678afecb367f032d93F642f64180aa3;
    uint256 internal constant MONAD_TESTNET = 10143;

    /// anvil key #0 — the FIXTURE principal. Public test key. NOT the demo principal.
    uint256 internal constant PK_PRINCIPAL =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address internal constant FIXTURE_PRINCIPAL = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    /// anvil key #1 — the agent our server signs as.
    uint256 internal constant PK_AGENT =
        0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    address internal constant AGENT = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    address internal constant STRANGER = address(0xBEEF);

    // Payee refs, already normalized (lowercase, no internal whitespace) so keccak of the
    // raw string equals hashPayeeRef() on the TypeScript side.
    bytes32 internal payeeHanzhou = keccak256(bytes("rain:payee:hanzhou-apparel"));
    bytes32 internal payeeYuanfeng = keccak256(bytes("rain:payee:yuanfeng-textiles"));
    bytes32 internal payeeRongcheng = keccak256(bytes("rain:payee:rongcheng-garment"));
    bytes32 internal fraudPayee = keccak256(bytes("rain:payee:hanzhou-apparel-new-account"));

    string internal vectorJson;

    function setUp() public {
        vm.chainId(MONAD_TESTNET);
        deployCodeTo("MandateRegistry.sol:MandateRegistry", VECTOR_REGISTRY);
        registry = MandateRegistry(VECTOR_REGISTRY);

        vectorJson = vm.readFile("../lib/mandate/__fixtures__/digest-vector.json");

        // Inside the vector's validity window (validAfter 1764547200, validUntil 1772323200).
        vm.warp(1765000000);
    }

    // ---------------------------------------------------------------- helpers

    function _uintFromJson(string memory key) internal view returns (uint256) {
        // Decimal strings, not JSON numbers — a uint256 does not survive a double.
        return vm.parseUint(vm.parseJsonString(vectorJson, key));
    }

    /// The mandate exactly as digest-vector.json describes it.
    function _vectorMandate() internal view returns (IMandateRegistry.MandateInput memory m) {
        m = IMandateRegistry.MandateInput({
            principal: vm.parseJsonAddress(vectorJson, ".mandate.principal"),
            agent: vm.parseJsonAddress(vectorJson, ".mandate.agent"),
            purchaseRequestId: vm.parseJsonBytes32(vectorJson, ".mandate.purchaseRequestId"),
            fundingSource: vm.parseJsonBytes32(vectorJson, ".mandate.fundingSource"),
            maxTotal: _uintFromJson(".mandate.maxTotal"),
            autonomousMax: _uintFromJson(".mandate.autonomousMax"),
            maxDepositBps: _uintFromJson(".mandate.maxDepositBps"),
            payeeScope: vm.parseJsonBytes32(vectorJson, ".mandate.payeeScope"),
            purpose: vm.parseJsonString(vectorJson, ".mandate.purpose"),
            validAfter: _uintFromJson(".mandate.validAfter"),
            validUntil: _uintFromJson(".mandate.validUntil"),
            nonce: vm.parseJsonBytes32(vectorJson, ".mandate.nonce")
        });
    }

    function _vectorSignature() internal view returns (bytes memory) {
        return vm.parseJsonBytes(vectorJson, ".signature");
    }

    /// The three payee leaves, strictly ascending, as computePayeeScope emitted them.
    function _payeeSet() internal view returns (bytes32[] memory set) {
        set = new bytes32[](3);
        set[0] = vm.parseJsonBytes32(vectorJson, ".expectedLeaves[0]");
        set[1] = vm.parseJsonBytes32(vectorJson, ".expectedLeaves[1]");
        set[2] = vm.parseJsonBytes32(vectorJson, ".expectedLeaves[2]");
    }

    /// Registers the vector mandate and returns its digest.
    function _register() internal returns (bytes32) {
        return registry.create(_vectorMandate(), _vectorSignature());
    }

    function _signApproval(
        bytes32 mandateHash,
        bytes32 payeeHash,
        uint256 amount,
        uint256 poValue,
        uint8 stage,
        bytes32 approvalNonce,
        uint256 pk
    ) internal view returns (bytes memory) {
        bytes32 digest = registry.hashApproval(mandateHash, payeeHash, amount, poValue, stage, approvalNonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ------------------------------------------------- 1. cross-language pin

    function test_create_reproducesTheTypeScriptDigestExactly() public {
        bytes32 expected = vm.parseJsonBytes32(vectorJson, ".expectedDigest");
        bytes32 actual = _register();
        assertEq(actual, expected, "Solidity digest must equal the digest viem computed");
    }

    function test_create_recoversTheFixturePrincipalNotTheDemoPrincipal() public {
        _register();
        address expectedSigner = vm.parseJsonAddress(vectorJson, ".expectedSigner");
        assertEq(expectedSigner, FIXTURE_PRINCIPAL, "vector must be signed by anvil #0");
    }

    /**
     * Proves point 2 of this file's header rather than asserting it: a registry at any
     * other address computes a different digest for the identical mandate. This is why
     * the test suite deployCodeTo's to the pinned address instead of regenerating the
     * vector — and it is a live tripwire if anyone ever "simplifies" setUp to `new`.
     */
    function test_digestIsBoundToTheRegistryAddress() public {
        MandateRegistry elsewhere = new MandateRegistry();
        assertTrue(address(elsewhere) != VECTOR_REGISTRY, "precondition");

        bytes32 pinned = registry.hashMandate(_vectorMandate());
        bytes32 drifted = elsewhere.hashMandate(_vectorMandate());

        assertEq(pinned, vm.parseJsonBytes32(vectorJson, ".expectedDigest"));
        assertTrue(drifted != pinned, "verifyingContract must be inside the domain separator");
    }

    // ------------------------------------------------------------- 2. D0

    function test_create_onTamperedMandate_revertsBadSignature() public {
        IMandateRegistry.MandateInput memory tampered = _vectorMandate();
        // ONE field changed: the ceiling the founder signed was $1,840. This says $18,400.
        tampered.maxTotal = _uintFromJson(".tamperedMandate.maxTotal");
        assertTrue(tampered.maxTotal != _uintFromJson(".mandate.maxTotal"), "tamper must differ");

        vm.expectRevert(IMandateRegistry.BadSignature.selector);
        registry.create(tampered, _vectorSignature());
    }

    // -------------------------------------------------------- 3. nonce replay

    function test_create_twiceOnSameInput_revertsMandateExists() public {
        _register();
        vm.expectRevert(IMandateRegistry.MandateExists.selector);
        registry.create(_vectorMandate(), _vectorSignature());
    }

    // ------------------------------------ 4. record's five conditions, each alone

    function test_record_revertsRevoked() public {
        bytes32 h = _register();
        vm.prank(FIXTURE_PRINCIPAL);
        registry.revoke(h);

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.Revoked.selector);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }

    function test_record_revertsNotYetValid() public {
        bytes32 h = _register();
        vm.warp(_uintFromJson(".mandate.validAfter") - 1);

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.NotYetValid.selector);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }

    function test_record_revertsExpired() public {
        bytes32 h = _register();
        vm.warp(_uintFromJson(".mandate.validUntil") + 1);

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.Expired.selector);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }

    /// The closer. A changed bank account is not in the signed scope, and the CONTRACT
    /// is what refuses it — not our server.
    function test_record_revertsPayeeOutOfScope() public {
        bytes32 h = _register();

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.PayeeOutOfScope.selector);
        registry.record(h, 18_000, fraudPayee, _payeeSet(), 0, 0, "", bytes32(0));
    }

    function test_record_revertsExceedsMaxTotal() public {
        bytes32 h = _register();

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.ExceedsMaxTotal.selector);
        registry.record(h, 184_001, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }

    function test_record_revertsDepositCapExceeded() public {
        bytes32 h = _register();

        // 30.01% of a 493_000 PO value, against a signed 3000 bps cap.
        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.DepositCapExceeded.selector);
        registry.record(h, 147_950, payeeHanzhou, _payeeSet(), 493_000, 1, "", bytes32(0));
    }

    // ------------------------------------------------- 5. the <= boundary

    function test_record_atExactly3000Bps_succeeds() public {
        bytes32 h = _register();
        bytes32 approvalNonce = keccak256("approval-1");
        bytes memory approval =
            _signApproval(h, payeeHanzhou, 147_900, 493_000, 1, approvalNonce, PK_PRINCIPAL);

        // 147_900 * 10000 == 493_000 * 3000, exactly. A `<` here hard-blocks our own winner.
        vm.prank(AGENT);
        uint256 remaining =
            registry.record(h, 147_900, payeeHanzhou, _payeeSet(), 493_000, 1, approval, approvalNonce);

        assertEq(remaining, 184_000 - 147_900);
    }

    // ------------------------------------------------------- 6. trap 10

    function test_record_fromNonAgent_revertsNotAgent() public {
        bytes32 h = _register();

        vm.prank(STRANGER);
        vm.expectRevert(IMandateRegistry.NotAgent.selector);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }

    function test_record_onUnknownMandate_revertsUnknownMandate() public {
        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.UnknownMandate.selector);
        registry.record(keccak256("never-registered"), 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }

    // ------------------------------------------------------ 7. payee set

    function test_record_withOutOfOrderPayeeSet_revertsBadPayeeSet() public {
        bytes32 h = _register();
        bytes32[] memory set = _payeeSet();
        (set[0], set[1]) = (set[1], set[0]);   // descending at the first pair

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.BadPayeeSet.selector);
        registry.record(h, 18_000, payeeHanzhou, set, 0, 0, "", bytes32(0));
    }

    function test_record_withNonMatchingPayeeSet_revertsBadPayeeSet() public {
        bytes32 h = _register();
        bytes32[] memory set = new bytes32[](2);
        set[0] = payeeHanzhou;
        set[1] = fraudPayee;
        if (uint256(set[0]) > uint256(set[1])) (set[0], set[1]) = (set[1], set[0]);

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.BadPayeeSet.selector);
        registry.record(h, 18_000, payeeHanzhou, set, 0, 0, "", bytes32(0));
    }

    // -------------------------------------------------------- 8. revocation

    function test_revoke_fromNonPrincipal_revertsNotPrincipal() public {
        bytes32 h = _register();

        vm.prank(AGENT);   // even the agent cannot revoke
        vm.expectRevert(IMandateRegistry.NotPrincipal.selector);
        registry.revoke(h);
    }

    function test_revoke_thenRecord_revertsRevoked() public {
        bytes32 h = _register();

        vm.prank(AGENT);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));

        vm.prank(FIXTURE_PRINCIPAL);
        registry.revoke(h);

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.Revoked.selector);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }

    // ------------------------------------------------- 9. D3 ceiling sequence

    /// The non-circular answer to "why does this need an agent?" — the agent halts
    /// itself against a ceiling it did not choose.
    function test_record_D3CeilingSequence() public {
        bytes32 h = _register();
        bytes32[] memory set = _payeeSet();

        vm.startPrank(AGENT);
        assertEq(registry.record(h, 18_000, payeeHanzhou, set, 0, 0, "", bytes32(0)), 166_000);
        assertEq(registry.record(h, 147_900, payeeHanzhou, set, 0, 0, "", bytes32(0)), 18_100);
        assertEq(registry.record(h, 18_000, payeeHanzhou, set, 0, 0, "", bytes32(0)), 100);

        vm.expectRevert(IMandateRegistry.ExceedsMaxTotal.selector);
        registry.record(h, 18_000, payeeHanzhou, set, 0, 0, "", bytes32(0));
        vm.stopPrank();

        assertEq(registry.remaining(h), 100);
    }

    // ------------------------------------------------------------ 10. R4

    /// Without this test, (b) buys nothing it claims to buy. A valid approval signature
    /// over a DIFFERENT poValue than the one passed to record must be rejected — otherwise
    /// the deposit ratio is still whatever our server asserted.
    function test_record_approvalOverDifferentPoValue_revertsBadApproval() public {
        bytes32 h = _register();
        bytes32 approvalNonce = keccak256("approval-1");

        // The founder signed an approval over a PO value of 493_000...
        bytes memory approval =
            _signApproval(h, payeeHanzhou, 147_900, 493_000, 1, approvalNonce, PK_PRINCIPAL);

        // ...but record is called asserting 986_000, which would halve the apparent ratio.
        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.BadApproval.selector);
        registry.record(h, 147_900, payeeHanzhou, _payeeSet(), 986_000, 1, approval, approvalNonce);
    }

    function test_record_approvalSignedByNonPrincipal_revertsBadApproval() public {
        bytes32 h = _register();
        bytes32 approvalNonce = keccak256("approval-1");

        // The agent signs its own approval. That is the whole attack.
        bytes memory approval =
            _signApproval(h, payeeHanzhou, 147_900, 493_000, 1, approvalNonce, PK_AGENT);

        vm.prank(AGENT);
        vm.expectRevert(IMandateRegistry.BadApproval.selector);
        registry.record(h, 147_900, payeeHanzhou, _payeeSet(), 493_000, 1, approval, approvalNonce);
    }

    function test_record_replayedApprovalNonce_revertsBadApproval() public {
        bytes32 h = _register();
        bytes32 approvalNonce = keccak256("approval-1");
        bytes memory approval =
            _signApproval(h, payeeHanzhou, 18_000, 60_000, 1, approvalNonce, PK_PRINCIPAL);

        vm.startPrank(AGENT);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 60_000, 1, approval, approvalNonce);

        vm.expectRevert(IMandateRegistry.BadApproval.selector);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 60_000, 1, approval, approvalNonce);
        vm.stopPrank();
    }

    // ------------------------------------------------------------- events

    function test_record_emitsPaymentAuthorizedWithPoValue() public {
        bytes32 h = _register();

        // D5: poValueMinor is emitted so the deposit ratio is third-party recomputable
        // from chain data alone.
        vm.expectEmit(true, false, false, true, address(registry));
        emit IMandateRegistry.PaymentAuthorized(h, 18_000, payeeHanzhou, 0, 0, 166_000);

        vm.prank(AGENT);
        registry.record(h, 18_000, payeeHanzhou, _payeeSet(), 0, 0, "", bytes32(0));
    }
}

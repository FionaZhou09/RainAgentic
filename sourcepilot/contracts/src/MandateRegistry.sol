// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IMandateRegistry} from "./IMandateRegistry.sol";

/**
 * MandateRegistry — the authority on whether a payment was authorized.
 *
 * ⚠ WHAT BREAKS IF YOU DELETE THE SERVER'S CALL TO THIS CONTRACT?
 *    The payment loses its authorization and the ceiling stops decrementing.
 *    If that answer ever becomes "nothing", the chain has regressed to an audit log
 *    and the project's central claim is gone.
 *
 * D0 — the digest is RECOMPUTED here from all twelve signed fields. `create` accepts no
 * mandateHash. A caller can supply a signature; it cannot supply what the signature covers.
 *
 * ⚠ The digest binds chainId AND verifyingContract (address(this)). Deploy this at a
 * different address and every previously signed mandate stops verifying — by design.
 *
 * R4 — `approvalNonce` is an explicit parameter, not derived. PaymentApproval carries a
 * `nonce` field, but `record`'s six §5 parameters contain nothing the contract could
 * reconstruct it from, so the digest would be uncomputable. Deriving one implicitly (e.g.
 * from `spent`) would silently break whenever another payment lands between signing and
 * execution. Consumed nonces are recorded so an approval cannot be replayed for a second
 * identical payment. Flagged for ratification — see the WP3 report.
 */
contract MandateRegistry is IMandateRegistry {
    bytes32 private constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    /// Field order is identical to MANDATE_TYPES in lib/mandate/types.ts. Do not reorder.
    bytes32 private constant MANDATE_TYPEHASH = keccak256(
        "ProcurementMandate(address principal,address agent,bytes32 purchaseRequestId,bytes32 fundingSource,uint256 maxTotal,uint256 autonomousMax,uint256 maxDepositBps,bytes32 payeeScope,string purpose,uint256 validAfter,uint256 validUntil,bytes32 nonce)"
    );

    bytes32 private constant APPROVAL_TYPEHASH = keccak256(
        "PaymentApproval(bytes32 mandateHash,bytes32 payeeHash,uint256 amount,uint256 poValue,uint8 stage,bytes32 nonce)"
    );

    uint8 private constant STAGE_DEPOSIT = 1;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// The enforceable subset, PLUS agent and nonce.
    struct Mandate {
        address principal;
        address agent;
        uint256 maxTotal;
        uint256 autonomousMax;
        uint256 maxDepositBps;
        bytes32 payeeScope;
        uint256 validAfter;
        uint256 validUntil;
        bytes32 nonce;
        uint256 spent;
        bool revoked;
        bool exists;
    }

    mapping(bytes32 => Mandate) private mandates;
    mapping(bytes32 => bool) private usedApprovalNonces;

    // ------------------------------------------------------------ EIP-712

    /**
     * Computed per call from block.chainid rather than cached at construction, so a chain
     * fork cannot leave a stale separator behind that would validate replayed signatures.
     */
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("SourcePilot")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /// Public so tests and clients can predict a digest without sending a transaction.
    function hashMandate(MandateInput calldata m) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                MANDATE_TYPEHASH,
                m.principal,
                m.agent,
                m.purchaseRequestId,
                m.fundingSource,
                m.maxTotal,
                m.autonomousMax,
                m.maxDepositBps,
                m.payeeScope,
                keccak256(bytes(m.purpose)),   // EIP-712 encodes a string as keccak of its bytes
                m.validAfter,
                m.validUntil,
                m.nonce
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function hashApproval(
        bytes32 mandateHash_,
        bytes32 payeeHash,
        uint256 amount,
        uint256 poValue,
        uint8 stage,
        bytes32 approvalNonce
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(APPROVAL_TYPEHASH, mandateHash_, payeeHash, amount, poValue, stage, approvalNonce)
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    // ------------------------------------------------------------- create

    function create(MandateInput calldata m, bytes calldata sig)
        external
        returns (bytes32 mandateHash)
    {
        // D0: recomputed here, never accepted from the caller.
        mandateHash = hashMandate(m);

        if (mandates[mandateHash].exists) revert MandateExists();
        if (_recover(mandateHash, sig) != m.principal) revert BadSignature();

        mandates[mandateHash] = Mandate({
            principal: m.principal,
            agent: m.agent,
            maxTotal: m.maxTotal,
            autonomousMax: m.autonomousMax,
            maxDepositBps: m.maxDepositBps,
            payeeScope: m.payeeScope,
            validAfter: m.validAfter,
            validUntil: m.validUntil,
            nonce: m.nonce,
            spent: 0,
            revoked: false,
            exists: true
        });

        emit MandateCreated(mandateHash, m.principal, m.agent);
    }

    // ------------------------------------------------------------- record

    /**
     * Called BEFORE Rain. Every check here is one the founder signed; none of them are
     * pre-empted off-chain, because "the contract reverted" has to be a true sentence.
     */
    function record(
        bytes32 mandateHash,
        uint256 amountMinor,
        bytes32 payeeHash,
        bytes32[] calldata payeeSet,
        uint256 poValueMinor,
        uint8   stage,
        bytes   calldata approvalSig,
        bytes32 approvalNonce
    ) external returns (uint256 remainingMinor) {
        Mandate storage md = mandates[mandateHash];
        if (!md.exists) revert UnknownMandate();

        // Closes trap 10 on-chain: our server holding the agent key is not enough,
        // the chain checks which key is calling.
        if (msg.sender != md.agent) revert NotAgent();

        if (md.revoked) revert Revoked();
        if (block.timestamp < md.validAfter) revert NotYetValid();
        if (block.timestamp > md.validUntil) revert Expired();

        _requirePayeeSetMatchesScope(payeeSet, md.payeeScope);
        if (!_contains(payeeSet, payeeHash)) revert PayeeOutOfScope();

        if (md.spent + amountMinor > md.maxTotal) revert ExceedsMaxTotal();

        if (stage == STAGE_DEPOSIT) {
            // `<=`, pinned: supplier B sits at EXACTLY 3000 bps and must pass.
            if (amountMinor * BPS_DENOMINATOR > poValueMinor * md.maxDepositBps) {
                revert DepositCapExceeded();
            }

            // R4: the PO value the ratio is measured against must be one the principal
            // signed, not one our server asserted.
            if (usedApprovalNonces[approvalNonce]) revert BadApproval();
            bytes32 approvalDigest =
                hashApproval(mandateHash, payeeHash, amountMinor, poValueMinor, stage, approvalNonce);
            if (_recover(approvalDigest, approvalSig) != md.principal) revert BadApproval();
            usedApprovalNonces[approvalNonce] = true;
        }

        md.spent += amountMinor;
        remainingMinor = md.maxTotal - md.spent;

        emit PaymentAuthorized(mandateHash, amountMinor, payeeHash, poValueMinor, stage, remainingMinor);
    }

    // ------------------------------------------------------------- revoke

    /// D4: principal only. Our server structurally cannot revoke, and that is the point.
    function revoke(bytes32 mandateHash) external {
        Mandate storage md = mandates[mandateHash];
        if (!md.exists) revert UnknownMandate();
        if (msg.sender != md.principal) revert NotPrincipal();

        md.revoked = true;
        emit MandateRevoked(mandateHash, block.timestamp);
    }

    function remaining(bytes32 mandateHash) external view returns (uint256) {
        Mandate storage md = mandates[mandateHash];
        if (!md.exists) revert UnknownMandate();
        return md.maxTotal - md.spent;
    }

    // ------------------------------------------------------------ internals

    /**
     * The payee set must be STRICTLY ascending and hash to the signed scope. Strictness
     * rejects duplicates, which would otherwise let the same leaf pad a set into matching.
     */
    function _requirePayeeSetMatchesScope(bytes32[] calldata payeeSet, bytes32 scope) private pure {
        if (payeeSet.length == 0) revert BadPayeeSet();
        for (uint256 i = 1; i < payeeSet.length; i++) {
            if (uint256(payeeSet[i]) <= uint256(payeeSet[i - 1])) revert BadPayeeSet();
        }
        if (keccak256(abi.encodePacked(payeeSet)) != scope) revert BadPayeeSet();
    }

    function _contains(bytes32[] calldata set, bytes32 needle) private pure returns (bool) {
        for (uint256 i = 0; i < set.length; i++) {
            if (set[i] == needle) return true;
        }
        return false;
    }

    /// Rejects malleable high-s signatures and the zero address rather than treating
    /// a failed recovery as a valid signer.
    function _recover(bytes32 digest, bytes memory sig) private pure returns (address) {
        if (sig.length != 65) return address(0);

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 0x20))
            s := mload(add(sig, 0x40))
            v := byte(0, mload(add(sig, 0x60)))
        }
        if (v < 27) v += 27;
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return address(0);
        }
        return ecrecover(digest, v, r, s);
    }
}

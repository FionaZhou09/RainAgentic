// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * The normative Solidity surface. Transcribed from INTERFACE-CONTRACTS.md §5 (frozen).
 * This is the canonical Solidity interface for the shipped registry.
 *
 * D0: `create` has NO mandateHash parameter. The digest is RECOMPUTED on-chain from all
 * twelve signed fields and RETURNED. Accepting a caller-supplied digest would let a server
 * pair a genuine signature with constraints the founder never agreed to — the defect this
 * ruling exists to kill.
 *
 * R4 (ratified): `record` carries `approvalSig` and `approvalNonce` beyond the six
 * parameters in §5's block. For `stage == 1` the contract ecrecovers the PaymentApproval
 * digest and requires signer == principal, else BadApproval(). See MandateRegistry.sol's
 * header for why `approvalNonce` had to become an explicit parameter.
 */
interface IMandateRegistry {
    /// D0: ALL TWELVE SIGNED FIELDS, in EIP-712 order.
    struct MandateInput {
        address principal;
        address agent;
        bytes32 purchaseRequestId;
        bytes32 fundingSource;
        uint256 maxTotal;
        uint256 autonomousMax;
        uint256 maxDepositBps;
        bytes32 payeeScope;
        string  purpose;
        uint256 validAfter;
        uint256 validUntil;
        bytes32 nonce;
    }

    error MandateExists();   error UnknownMandate();  error BadSignature();
    error NotAgent();        error NotPrincipal();
    error Revoked();         error NotYetValid();     error Expired();
    error PayeeOutOfScope(); error ExceedsMaxTotal(); error DepositCapExceeded();
    error BadPayeeSet();     // payeeSet doesn't hash to payeeScope, or isn't strictly ascending
    error BadApproval();     // R4: approval signature does not cover the submitted values

    event MandateCreated(bytes32 indexed mandateHash, address indexed principal, address indexed agent);
    /// D5: poValueMinor is emitted so the deposit ratio is third-party recomputable from chain data alone.
    event PaymentAuthorized(bytes32 indexed mandateHash, uint256 amountMinor, bytes32 payeeHash,
                            uint256 poValueMinor, uint8 stage, uint256 remainingMinor);
    event MandateRevoked(bytes32 indexed mandateHash, uint256 at);

    function create(MandateInput calldata m, bytes calldata sig) external returns (bytes32 mandateHash);

    function record(
        bytes32 mandateHash,
        uint256 amountMinor,
        bytes32 payeeHash,
        bytes32[] calldata payeeSet,
        uint256 poValueMinor,
        uint8   stage,
        bytes   calldata approvalSig,
        bytes32 approvalNonce
    ) external returns (uint256 remainingMinor);

    /// D4: principal only. Called from a visible terminal via `cast send`. No server path, no wagmi.
    function revoke(bytes32 mandateHash) external;

    /// On demand only — testnet caps eth_call at 25 rps. No polling loops anywhere.
    function remaining(bytes32 mandateHash) external view returns (uint256);
}

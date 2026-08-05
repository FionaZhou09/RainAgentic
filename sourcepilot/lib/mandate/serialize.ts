/**
 * JSON <-> ProcurementMandate conversion. Plumbing for the digest vector and for §7's
 * `MandateRequest.mandate`, which carries bigints as decimal strings.
 *
 * Decimal strings, never JSON numbers: a uint256 does not survive a double, and the
 * Solidity side reads these with vm.parseJsonString + vm.parseUint.
 */
import type { ProcurementMandate, SerializedMandate } from "./types";

export function serializeMandate(m: ProcurementMandate): SerializedMandate {
  return {
    principal: m.principal,
    agent: m.agent,
    purchaseRequestId: m.purchaseRequestId,
    fundingSource: m.fundingSource,
    maxTotal: m.maxTotal.toString(),
    autonomousMax: m.autonomousMax.toString(),
    maxDepositBps: m.maxDepositBps.toString(),
    payeeScope: m.payeeScope,
    purpose: m.purpose,
    validAfter: m.validAfter.toString(),
    validUntil: m.validUntil.toString(),
    nonce: m.nonce,
  };
}

export function deserializeMandate(s: SerializedMandate): ProcurementMandate {
  return {
    principal: s.principal,
    agent: s.agent,
    purchaseRequestId: s.purchaseRequestId,
    fundingSource: s.fundingSource,
    maxTotal: BigInt(s.maxTotal),
    autonomousMax: BigInt(s.autonomousMax),
    maxDepositBps: BigInt(s.maxDepositBps),
    payeeScope: s.payeeScope,
    purpose: s.purpose,
    validAfter: BigInt(s.validAfter),
    validUntil: BigInt(s.validUntil),
    nonce: s.nonce,
  };
}

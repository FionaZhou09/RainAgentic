import type { Address, Hex, WalletClient } from "viem";
import { APPROVAL_TYPES, MANDATE_TYPES, mandateDomain, type MandateDomainConfig, type PaymentApproval, type ProcurementMandate } from "../sourcepilot/lib/mandate/types";

export async function signMandateWithWallet(wallet: WalletClient, account: Address, mandate: ProcurementMandate, domain: MandateDomainConfig): Promise<Hex> {
  return wallet.signTypedData({ account, domain: mandateDomain(domain), types: MANDATE_TYPES, primaryType: "ProcurementMandate", message: mandate });
}

export async function signApprovalWithWallet(wallet: WalletClient, account: Address, approval: PaymentApproval, domain: MandateDomainConfig): Promise<Hex> {
  return wallet.signTypedData({ account, domain: mandateDomain(domain), types: APPROVAL_TYPES, primaryType: "PaymentApproval", message: approval });
}

import { APPROVAL_ONCHAIN_VERIFY } from "@/lib/chain/registry";

export const ENFORCEMENT_CLAIM = {
  callerAsserted:
    "The contract enforces the ceiling, the payee scope, the time window, and revocation. " +
    "The deposit ratio is asserted by the caller and bound into the signed approval — " +
    "so it's auditable, but I won't claim it's unforgeable.",
  approvalVerified:
    "The contract enforces the ceiling, the payee scope, the time window, and revocation. " +
    "On this payment it also enforces the deposit cap — it checks the founder's approval " +
    "signature on-chain, so the PO value the ratio is measured against is one she signed, " +
    "not one our server asserted. What no contract can check is whether that PO value " +
    "matches the real invoice. That's the remaining seam, and I'd rather name it than let you find it.",
} as const;

export const DEMO_COPY = {
  enforcementClaim: APPROVAL_ONCHAIN_VERIFY
    ? ENFORCEMENT_CLAIM.approvalVerified
    : ENFORCEMENT_CLAIM.callerAsserted,
  retryLabel: "The agent tries that order again",
  mandateExpiryLabel: "Expires in ninety days",
  deliveryDeadlineLabel: "Delivery within sixty days",
  dutyLine:
    "HTS 6109.10.00 MFN base rate — excludes Section 301 and trade-remedy tiers",
  landedReferenceLabel: "Landed budget reference: $12.00/unit (informational)",
  productName: "SourcePilot",
  productMark: "SP",
  pageTitle: "Supplier comparison",
  pageSummary: "Three quotes evaluated against the founder's signed purchasing terms.",
  environmentLabel: "Environment",
  requestLabel: "Purchase request",
  quantityLabel: "Quantity",
  destinationLabel: "Destination",
  recommendedLabel: "Recommended",
  rankLabel: "Rank",
  notRankedLabel: "Not ranked",
  landedCostLabel: "Landed cost",
  unquotableLabel: "Unquotable",
  leadTimeLabel: "Lead time",
  specMatchLabel: "Spec match",
  depositLabel: "Deposit",
  policyChecksLabel: "Policy checks",
  clearsTermsLabel: "Clears signed sourcing terms",
  networkSpaceTitle: "Network evidence",
  networkSpaceBody: "Reserved for DevTools during the blocked-payment proof.",
  suppliersReviewedLabel: "Suppliers reviewed",
  unitsLabel: "units",
  daysLabel: "days",
} as const;

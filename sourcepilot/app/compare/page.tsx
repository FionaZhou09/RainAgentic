import { CompareScreen } from "@/components/compare-screen";
import { ASSUMPTIONS, PR_1042, QUOTES, SUPPLIERS } from "@/lib/fixtures/pr-1042";
import { assessQuotes } from "@/lib/score";
import { environmentLabel } from "@/components/environment-label";

export default function ComparePage() {
  return (
    <CompareScreen
      purchaseRequest={PR_1042}
      quotes={QUOTES}
      suppliers={SUPPLIERS}
      assessments={assessQuotes(PR_1042, QUOTES, SUPPLIERS, ASSUMPTIONS)}
      environment={environmentLabel(process.env.CHAIN_ID) as "Local Anvil" | "Monad Testnet"}
    />
  );
}

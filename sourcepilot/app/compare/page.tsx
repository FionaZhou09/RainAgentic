import { CompareScreen } from "@/components/compare-screen";
import { ASSUMPTIONS, PR_1042, QUOTES, SUPPLIERS } from "@/lib/fixtures/pr-1042";
import { assessQuotes } from "@/lib/score";

export default function ComparePage() {
  return (
    <CompareScreen
      purchaseRequest={PR_1042}
      quotes={QUOTES}
      suppliers={SUPPLIERS}
      assessments={assessQuotes(PR_1042, QUOTES, SUPPLIERS, ASSUMPTIONS)}
      environment="Local Anvil"
    />
  );
}

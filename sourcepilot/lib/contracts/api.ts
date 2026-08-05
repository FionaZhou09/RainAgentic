export interface Rationale {
  facts: string[];        // computed by /lib/cost and /lib/score. Slot-filled, never generated.
  assumptions: string[];  // duty label, hardcoded FX, freight assumption for C
  missingData: string[];  // named explicitly. "Supplier C did not state shipping."
  decision: string;
}

import { describe, expect, it } from "vitest";
import { QUOTE_A, QUOTE_B, QUOTE_C } from "@/lib/fixtures/pr-1042";
import { extractQuotes } from "./extract";

describe("extractQuotes", () => {
  it("accepts the valid fixture quotes without changing their values", () => {
    const extracted = extractQuotes([QUOTE_A, QUOTE_B, QUOTE_C]);

    expect(extracted).toEqual([QUOTE_A, QUOTE_B, QUOTE_C]);
    expect(extracted).not.toBe([QUOTE_A, QUOTE_B, QUOTE_C]);
  });

  it("rejects a malformed quote and identifies the invalid field", () => {
    expect(() => extractQuotes([{ ...QUOTE_A, currency: "EUR" }])).toThrow(
      /quotes\[0\]\.currency/,
    );
  });
});

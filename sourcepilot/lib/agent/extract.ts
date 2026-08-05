import type { QuoteInput } from "@/lib/contracts/sourcing";

type ObjectRecord = Record<string, unknown>;

const quoteFields = [
  "id",
  "supplierId",
  "purchaseRequestId",
  "currency",
  "unitPrice",
  "quantity",
  "samplingFee",
  "shipping",
  "leadTimeDays",
  "depositBps",
  "specMatchPct",
] as const;

export class QuoteExtractionError extends Error {
  constructor(path: string, expectation: string) {
    super(`${path} must be ${expectation}`);
    this.name = "QuoteExtractionError";
  }
}

/** Validate untrusted extraction output against the frozen QuoteInput schema. */
export function extractQuotes(input: unknown): QuoteInput[] {
  if (!Array.isArray(input)) throw new QuoteExtractionError("quotes", "an array");
  return input.map((value, index) => parseQuote(value, `quotes[${index}]`));
}

function parseQuote(value: unknown, path: string): QuoteInput {
  if (!isObject(value)) throw new QuoteExtractionError(path, "an object");
  for (const field of quoteFields) {
    if (!Object.hasOwn(value, field)) {
      throw new QuoteExtractionError(`${path}.${field}`, "present");
    }
  }

  return {
    id: stringAt(value, "id", path),
    supplierId: stringAt(value, "supplierId", path),
    purchaseRequestId: stringAt(value, "purchaseRequestId", path),
    currency: usdAt(value, path),
    unitPrice: nullableIntegerAt(value, "unitPrice", path, 0) as QuoteInput["unitPrice"],
    quantity: nullableIntegerAt(value, "quantity", path, 1),
    samplingFee: nullableIntegerAt(value, "samplingFee", path, 0) as QuoteInput["samplingFee"],
    shipping: nullableIntegerAt(value, "shipping", path, 0) as QuoteInput["shipping"],
    leadTimeDays: nullableIntegerAt(value, "leadTimeDays", path, 0),
    depositBps: nullableIntegerAt(value, "depositBps", path, 0, 10_000) as QuoteInput["depositBps"],
    specMatchPct: nullableIntegerAt(value, "specMatchPct", path, 0, 100),
  };
}

function isObject(value: unknown): value is ObjectRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringAt(value: ObjectRecord, field: string, path: string): string {
  const candidate = value[field];
  if (typeof candidate !== "string" || candidate.length === 0) {
    throw new QuoteExtractionError(`${path}.${field}`, "a non-empty string");
  }
  return candidate;
}

function usdAt(value: ObjectRecord, path: string): "USD" {
  if (value.currency !== "USD") {
    throw new QuoteExtractionError(`${path}.currency`, 'the literal "USD"');
  }
  return "USD";
}

function nullableIntegerAt(
  value: ObjectRecord,
  field: string,
  path: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number | null {
  const candidate = value[field];
  if (candidate === null) return null;
  if (!Number.isSafeInteger(candidate) || (candidate as number) < minimum || (candidate as number) > maximum) {
    throw new QuoteExtractionError(
      `${path}.${field}`,
      `null or a safe integer between ${minimum} and ${maximum}`,
    );
  }
  return candidate as number;
}

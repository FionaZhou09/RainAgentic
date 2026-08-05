/**
 * Money primitives. Integer minor units everywhere — never a float, never dollars.
 * Transcribed from INTERFACE-CONTRACTS.md §1 (frozen). Do not alter a signature.
 */

/** Integer US cents. Never a float. Never dollars. */
export type Cents = number & { readonly __brand: "Cents" };
/** Basis points. 3000 = 30.00%. */
export type Bps = number & { readonly __brand: "Bps" };

export type Hex = `0x${string}`;
export type Address = Hex;
export type Bytes32 = Hex;

/** @throws RangeError on a non-integer — a float must never enter money arithmetic. */
export function cents(n: number): Cents {
  if (!Number.isInteger(n)) {
    throw new RangeError(`cents() requires an integer number of cents, got ${n}`);
  }
  return n as Cents;
}

/** @throws RangeError outside the inclusive range [0, 10_000], or on a non-integer. */
export function bps(n: number): Bps {
  if (!Number.isInteger(n)) {
    throw new RangeError(`bps() requires an integer, got ${n}`);
  }
  if (n < 0 || n > 10_000) {
    throw new RangeError(`bps() must be within [0, 10000], got ${n}`);
  }
  return n as Bps;
}

/**
 * THE ONLY rounding rule in this codebase: half-up, at cent granularity,
 * applied once per derived line item, never to an already-rounded value.
 * Integer arithmetic; the divisor is always 10_000.
 *
 * Half-up is implemented as floor((base * rate + 5000) / 10000). Inputs are
 * non-negative in this codebase (costs, fees, deposits); for a negative `base`
 * this rounds toward -Infinity at the .5 boundary, which no caller relies on.
 *
 * The largest intermediate the demo produces is 493_000 * 10_000 ≈ 4.9e9,
 * comfortably inside Number.MAX_SAFE_INTEGER (~9.0e15), so this stays exact.
 */
export function applyBps(base: Cents, rate: Bps): Cents {
  return Math.floor((base * rate + 5_000) / 10_000) as Cents;
}

/** Display only — the returned string never re-enters arithmetic. */
export function fmtUSD(c: Cents): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(c / 100);
}

/**
 * Per-unit cost. `exactMilliCents` is deliberately UNROUNDED so a rounded display
 * value can never be fed back into arithmetic; `display` is dollars to four decimals,
 * rounded half-up using integer math (not toFixed) so it is float-quirk free.
 */
export function perUnit(total: Cents, qty: number): { exactMilliCents: number; display: string } {
  const exactMilliCents = (total * 1_000) / qty;
  // dollars * 10_000, rounded half-up, using integers: total cents * 100 / qty
  const tenThousandths = Math.floor((total * 100) / qty + 0.5);
  return {
    exactMilliCents,
    display: (tenThousandths / 10_000).toFixed(4),
  };
}

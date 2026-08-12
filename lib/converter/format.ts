/**
 * format.ts
 * ---------------------------------------------------------------------------
 * Number formatting for the converter.
 *
 * The hard part here is that one formatter has to serve amounts eight orders of
 * magnitude apart: 63,729 US dollars and 0.00000042 BTC are both legitimate
 * results of the same conversion. A fixed number of decimals is wrong for one
 * end or the other — 2dp turns a small crypto balance into "0.00", and 8dp
 * turns a dollar amount into a wall of zeroes. So the decimal count is chosen
 * from the MAGNITUDE of the value rather than from the currency.
 */

import type { Asset } from "./assets";

/** Currencies conventionally written without a minor unit. */
const ZERO_DECIMAL_FIAT = new Set(["JPY", "KRW"]);

/**
 * How many decimals a value of this size deserves. Roughly: keep about five
 * significant digits, and never fewer than the currency's own convention.
 */
function decimalsFor(value: number, asset: Asset): number {
  const abs = Math.abs(value);

  if (asset.kind === "fiat") {
    const base = ZERO_DECIMAL_FIAT.has(asset.code) ? 0 : 2;
    // A sub-cent fiat amount still wants to show something other than 0.00 —
    // this comes up converting a few hundred satoshi into dollars.
    if (abs > 0 && abs < 0.01) return 6;
    return base;
  }

  if (abs === 0) return 2;
  if (abs >= 1000) return 2;
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 6;
  return 8;
}

/** Formatted amount WITHOUT the ticker — the ticker is rendered beside it. */
export function formatAmount(value: number, asset: Asset): string {
  if (!Number.isFinite(value)) return "";

  const decimals = decimalsFor(value, asset);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: asset.kind === "fiat" ? decimals : 0,
    maximumFractionDigits: decimals,
  }).format(value);

  // A tiny non-zero amount that rounds away entirely is more honestly shown as
  // a bound than as a flat zero, which reads as "this is worth nothing".
  if (value > 0 && Number(formatted.replace(/,/g, "")) === 0) {
    return `< ${(10 ** -decimals).toFixed(decimals)}`;
  }

  return formatted;
}

/** "1 BTC = 63,729.00 USD", the line under the conversion. */
export function formatRateLine(from: Asset, to: Asset, rate: number): string {
  return `1 ${from.code} = ${formatAmount(rate, to)} ${to.code}`;
}

/**
 * Parse what the user typed. Digit grouping is stripped so a pasted "1,250"
 * works, and a bare "." or "" is treated as zero rather than NaN so the other
 * side of the converter clears instead of showing an error mid-typing.
 */
export function parseAmount(input: string): number {
  const cleaned = input.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

/** "updated 12s ago" — relative, because an absolute clock time in a live
 *  quote makes the reader do the subtraction themselves. */
export function formatAge(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

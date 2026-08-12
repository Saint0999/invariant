/**
 * demo.ts
 * ---------------------------------------------------------------------------
 * Fixed sample data for the landing page's preview cards and chart.
 *
 * WHY THE LANDING PAGE DOES NOT USE THE LIVE FEED
 * The previews exist to show what the tools look like in use, and for that a
 * frozen snapshot is strictly better than the real thing:
 *
 *   - Every visitor to the marketing page cost an /api/rates poll, which spends
 *     the upstream rate-limit budget on people who have not opened a tool yet.
 *   - A preview has no error state worth building. When the feed is slow the
 *     real tools say so and offer a retry; a card on a landing page can only
 *     sit there showing skeletons, which is a worse first impression than any
 *     number would have been.
 *   - The numbers are illustrative either way. Nobody trades off a card with no
 *     amount field, and the tools themselves are one click away with the real
 *     rate.
 *
 * The prices below are a real snapshot, kept in the same shape as the feed's
 * own payload — USD per unit, exactly like /api/rates returns — so convert()
 * and the formatters work on it unchanged, and swapping a card back onto the
 * live hook is a one-line change if that is ever wanted.
 */

/** USD per unit, matching RatesPayload["usdPerUnit"]. */
export const DEMO_USD_PER_UNIT: Record<string, number> = {
  /* Crypto */
  BTC: 64094.85,
  ETH: 1908.25,
  USDT: 0.999169,
  USDC: 0.999643,
  BNB: 613.5499,
  SOL: 76.7423,
  XRP: 0.5182,
  ADA: 0.3874,
  /*
    The tail of the list. Every crypto in assets.ts is priced here, not just the
    ones a card happens to show today: a code with no entry renders as an em
    dash, so a table that stops early turns any change to how many rows the
    crawl carries into a row of blanks. Cheaper to price the whole list once.
  */
  DOGE: 0.12384,
  AVAX: 27.8516,
  POL: 0.43117,
  ARB: 0.61803,
  LINK: 11.4237,
  LTC: 64.2918,
  TRX: 0.128514,
  DOT: 4.28194,

  /* Fiat. USD is the unit the table is quoted in, so it is exactly 1. */
  USD: 1,
  EUR: 1.0842,
  GBP: 1.2716,
  INR: 0.011957,
  JPY: 0.006405,
};

/** 24h percent move against USD, matching RatesPayload["change24h"]. */
export const DEMO_CHANGE_24H: Record<string, number> = {
  BTC: -0.14,
  ETH: 1.25,
  USDT: 0.0021,
  USDC: -0.0008,
  BNB: 0.99,
  SOL: 2.41,
  XRP: -0.62,
  ADA: 0.38,
  DOGE: 3.07,
  AVAX: -1.18,
  POL: 0.74,
  ARB: -2.05,
  LINK: 1.62,
  LTC: -0.41,
  TRX: 0.29,
  DOT: -1.44,
};

/* ==========================================================================
 * Chart series
 * ========================================================================== */

export type DemoPoint = [number, number];

/**
 * A tiny linear congruential generator, seeded per series.
 *
 * DETERMINISTIC ON PURPOSE, and the reason this is not Math.random(): the
 * chart renders on the server and again on the client, and a random walk would
 * draw two different paths and blow up hydration. A seed also means the shape
 * is a fixed asset of the page — it can be looked at, tuned, and it will look
 * the same tomorrow — rather than something regenerated on every load.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    // Numerical Recipes' constants; the >>> keeps it in unsigned 32-bit range.
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Builds a plausible price series ENDING at `end`, having moved `changePct`
 * across the window.
 *
 * A RANDOM WALK, NOT PER-POINT NOISE. The obvious implementation — trend plus
 * an independent random offset at each sample — draws a sawtooth: every point
 * is uncorrelated with its neighbours, so the line zigzags the full width of
 * the noise band between one sample and the next. Real prices wander. Summing
 * the increments instead means each point starts from where the last one
 * ended, which is what produces runs, pullbacks and quiet stretches rather
 * than a comb.
 *
 * The walk is then detrended and rescaled, in that order:
 *   - DETREND, so the deviation is exactly zero at both ends. That pins the
 *     first point to the open implied by `changePct` and the last to `end` —
 *     the price the cards and the board print directly above the chart. A
 *     series that drifted off its own final value would contradict the number
 *     beside it.
 *   - RESCALE to `amplitude`, the widest excursion from the trend as a fraction
 *     of price, so each asset's texture is a number that can be tuned by eye
 *     instead of an emergent property of the step size and the sample count.
 */
export function demoSeries(
  seed: number,
  end: number,
  changePct: number,
  amplitude: number,
  count: number,
  spanMs: number,
  /** Anchor for the last sample; earlier points are spaced back from it. */
  endsAt: number,
): DemoPoint[] {
  const random = seeded(seed);
  const start = end / (1 + changePct / 100);
  const step = spanMs / (count - 1);

  /* ---- 1. The walk ---------------------------------------------------- */
  const walk: number[] = [0];
  for (let i = 1; i < count; i += 1) {
    walk.push(walk[i - 1] + (random() - 0.5));
  }

  /* ---- 2. Detrend, so both ends sit on zero --------------------------- */
  const drift = walk[count - 1];
  for (let i = 0; i < count; i += 1) {
    walk[i] -= (drift * i) / (count - 1);
  }

  /* ---- 3. Rescale to the requested amplitude -------------------------- */
  const peak = Math.max(...walk.map(Math.abs)) || 1;
  const scale = amplitude / peak;

  /* ---- 4. Trend + deviation ------------------------------------------- */
  const points: DemoPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);

    /*
      Smoothstep rather than a straight line: an evenly climbing trend reads as
      a generated ramp however much noise sits on top of it, where an eased one
      gives the series somewhere to be slow and somewhere to run.
    */
    const eased = t * t * (3 - 2 * t);
    const trend = start + (end - start) * eased;

    points.push([endsAt - spanMs + i * step, trend * (1 + walk[i] * scale)]);
  }

  return points;
}
